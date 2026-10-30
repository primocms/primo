package hosting

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed assets/*
var assets embed.FS

type Provisioner interface {
	CheckSlug(context.Context, string) error
	Step(context.Context, *Job, *Credentials) error
}
type Mailer interface {
	Send(context.Context, string, string, string, string) error
}

type Service struct {
	Config      Config
	Store       *Store
	Provisioner Provisioner
	Mailer      Mailer
	Now         func() time.Time
	Backups     *BackupManager
	Credentials *CredentialManager
	Suspender   CustomerSuspender
	mu          sync.Mutex
	workerMu    sync.Mutex
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func VerifyWebhook(secret, scheme string, headers http.Header, raw []byte, now time.Time) bool {
	id, stamp := headers.Get("webhook-id"), headers.Get("webhook-timestamp")
	seconds, err := strconv.ParseInt(stamp, 10, 64)
	if err != nil || id == "" || len(id) > 256 || seconds < now.Add(-5*time.Minute).Unix() || seconds > now.Add(5*time.Minute).Unix() {
		return false
	}
	key := []byte(secret)
	if scheme == "standard" {
		key, err = base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
		if err != nil || len(key) < 16 {
			return false
		}
	} else if scheme != "legacy" || len(key) < 16 {
		return false
	}
	h := hmac.New(sha256.New, key)
	h.Write([]byte(id + "." + stamp + "."))
	h.Write(raw)
	for _, sig := range strings.Fields(headers.Get("webhook-signature")) {
		kind, value, ok := strings.Cut(sig, ",")
		if !ok || kind != "v1" {
			continue
		}
		got, err := base64.StdEncoding.DecodeString(value)
		if err == nil && hmac.Equal(got, h.Sum(nil)) {
			return true
		}
	}
	return false
}

type paidEvent struct {
	Type string `json:"type"`
	Data struct {
		ID               string    `json:"id"`
		CreatedAt        time.Time `json:"created_at"`
		CurrentPeriodEnd time.Time `json:"current_period_end"`
		Paid             bool      `json:"paid"`
		BillingReason    string    `json:"billing_reason"`
		ProductID        string    `json:"product_id"`
		SubscriptionID   string    `json:"subscription_id"`
		CustomerID       string    `json:"customer_id"`
		Customer         struct {
			ID    string `json:"id"`
			Email string `json:"email"`
		} `json:"customer"`
	} `json:"data"`
}

func (s *Service) webhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "invalid payload", 400)
		return
	}
	if !VerifyWebhook(s.Config.WebhookSecret, s.Config.WebhookScheme, r.Header, raw, s.now()) {
		http.Error(w, "invalid signature", 403)
		return
	}
	var event paidEvent
	if err := json.Unmarshal(raw, &event); err != nil || event.Type == "" {
		http.Error(w, "invalid event", 400)
		return
	}
	result := "ignored_event"
	var job *Job
	d := event.Data
	if event.Type == "subscription.revoked" || event.Type == "order.refunded" {
		subscription := d.SubscriptionID
		if event.Type == "subscription.revoked" {
			subscription = d.ID
		}
		if subscription != "" {
			var err error
			if event.Type == "subscription.revoked" {
				// A terminal event is durable even if it arrives before the paid order.
				// Respect the paid period; ordinary cancellation events do not stop access.
				after := max(s.now().Unix(), d.CurrentPeriodEnd.Unix())
				err = s.Store.Revoke(r.Header.Get("webhook-id"), subscription, after)
			} else {
				err = s.Store.Hold(r.Header.Get("webhook-id"), event.Type, subscription)
			}
			if err != nil {
				http.Error(w, "unable to store billing review", 503)
				return
			}
			w.WriteHeader(202)
			return
		}
	}
	if event.Type == "order.paid" {
		plan, supported := s.Config.Products[d.ProductID]
		switch {
		case !d.Paid:
			result = "unpaid"
		case d.BillingReason != "subscription_create":
			result = "renewal_or_other_order"
		case d.CreatedAt.IsZero() || d.CreatedAt.Before(s.Config.Cutover):
			result = "before_cutover"
		case !supported:
			result = "manual_product"
		default:
			address, err := mail.ParseAddress(d.Customer.Email)
			if err != nil || address.Address != d.Customer.Email || d.ID == "" || d.SubscriptionID == "" || d.CustomerID == "" || d.CustomerID != d.Customer.ID {
				http.Error(w, "missing purchase identity", 400)
				return
			}
			id, err := randomToken()
			if err != nil {
				http.Error(w, "unable to queue signup", 503)
				return
			}
			// A stable app name is recorded before any external side effects.
			id = hashToken(id)[:24]
			token, err := randomToken()
			if err != nil {
				http.Error(w, "unable to queue signup", 503)
				return
			}
			secret, err := s.Store.seal(id+":claim", token)
			if err != nil {
				http.Error(w, "unable to queue signup", 503)
				return
			}
			job = &Job{ID: id, Subscription: d.SubscriptionID, Order: d.ID, Customer: d.CustomerID, Email: d.Customer.Email,
				Plan: plan, State: "invite", ClaimHash: hashToken(token), ClaimSecret: secret, ClaimExpires: s.now().Add(72 * time.Hour).Unix(),
				NextAt: s.now().Unix(), UpdatedAt: s.now().Unix()}
			result = "queued"
		}
	}
	if err := s.Store.accept(r.Header.Get("webhook-id"), event.Type, result, job, s.purchaseNotification(event, result)); err != nil {
		http.Error(w, "unable to store event", 503)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

var slugPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,28}[a-z0-9]$`)

func ValidSlug(slug string) bool {
	if !slugPattern.MatchString(slug) || strings.Contains(slug, "--") {
		return false
	}
	switch slug {
	case "www", "api", "app", "admin", "mail", "smtp", "ftp", "status", "support", "billing", "hosted", "hosting", "setup", "fly-smoke", "fly-domain-test":
		return false
	}
	return true
}

func (s *Service) findClaim(token string) (Job, error) {
	if len(token) != 43 {
		return Job{}, ErrClaim
	}
	jobs, err := s.Store.Jobs()
	if err != nil {
		return Job{}, err
	}
	for _, j := range jobs {
		if (j.State == "invite" || j.State == "awaiting_claim") && j.ClaimHash == hashToken(token) && j.ClaimExpires > s.now().Unix() {
			if held, err := s.Store.Held(j.Subscription); err != nil {
				return Job{}, err
			} else if held {
				return Job{}, ErrClaim
			}
			return j, nil
		}
	}
	return Job{}, ErrClaim
}
func jsonResponse(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
func readJSON(w http.ResponseWriter, r *http.Request, v any) error {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		return errors.New("JSON required")
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return err
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return errors.New("unexpected extra JSON")
	}
	return nil
}
func (s *Service) claimInfo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if readJSON(w, r, &body) != nil {
		http.Error(w, "invalid request", 400)
		return
	}
	j, err := s.findClaim(body.Token)
	if err != nil {
		http.Error(w, ErrClaim.Error(), 403)
		return
	}
	jsonResponse(w, 200, map[string]any{"plan": j.Plan.Name, "domain": s.Config.Domain, "email": j.Email})
}
func (s *Service) claim(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") != s.Config.PublicURL {
		http.Error(w, "invalid origin", 403)
		return
	}
	var body struct {
		Token    string `json:"token"`
		Slug     string `json:"slug"`
		Password string `json:"password"`
	}
	if readJSON(w, r, &body) != nil {
		http.Error(w, "invalid request", 400)
		return
	}
	if !ValidSlug(body.Slug) || len(body.Password) < 12 || len(body.Password) > 72 || strings.ContainsAny(body.Password, "\r\n\x00") {
		http.Error(w, "use a valid server name and a password of 12–72 bytes", 400)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.findClaim(body.Token); err != nil {
		http.Error(w, ErrClaim.Error(), 403)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	if err := s.Provisioner.CheckSlug(ctx, body.Slug); err != nil {
		if errors.Is(err, ErrSlug) {
			http.Error(w, "that server name is unavailable; try another", 409)
		} else {
			http.Error(w, "unable to check the server name; try again shortly", 503)
		}
		return
	}
	session, err := randomToken()
	if err != nil {
		http.Error(w, "unable to start setup", 503)
		return
	}
	j, err := s.Store.Claim(body.Token, body.Slug, body.Password, session, s.now())
	if err != nil {
		status := 503
		if errors.Is(err, ErrClaim) {
			status = 403
		}
		if errors.Is(err, ErrSlug) {
			status = 409
		}
		http.Error(w, "unable to claim this server name or setup link", status)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "__Host-primo-setup", Value: j.ID + "." + session, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 7 * 24 * 60 * 60})
	jsonResponse(w, 202, publicJob(j, s.Config.Domain))
}
func publicJob(j Job, domain string) map[string]any {
	state := "provisioning"
	if j.State == "ready" || j.State == "ready_email" {
		state = "ready"
	}
	if j.State == "attention" {
		state = "attention"
		if j.Error == "ready_email" {
			state = "ready"
		}
	}
	if j.Suspension.CompletedAt > 0 {
		state = "suspended"
	}
	url := ""
	if j.Slug != "" {
		url = "https://" + j.Slug + "." + domain + "/admin/auth"
	}
	return map[string]any{"state": state, "url": url, "plan": j.Plan.Name}
}
func (s *Service) status(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("__Host-primo-setup")
	if err != nil {
		http.Error(w, "setup session required", 401)
		return
	}
	id, session, ok := strings.Cut(cookie.Value, ".")
	if !ok || len(id) != 24 || len(session) != 43 {
		http.Error(w, "invalid setup session", 401)
		return
	}
	j, err := s.Store.Get(id)
	if err != nil || j.SessionExpires <= s.now().Unix() || subtle.ConstantTimeCompare([]byte(j.SessionHash), []byte(hashToken(session))) != 1 {
		http.Error(w, "invalid setup session", 401)
		return
	}
	held, err := s.Store.Held(j.Subscription)
	if err != nil {
		http.Error(w, "unable to read setup status", 503)
		return
	}
	if held && j.State != "ready" && j.State != "ready_email" {
		j.State = "attention"
	}
	jsonResponse(w, 200, publicJob(j, s.Config.Domain))
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /webhooks/polar", s.webhook)
	mux.HandleFunc("POST /api/setup/info", s.claimInfo)
	mux.HandleFunc("POST /api/setup/claim", s.claim)
	mux.HandleFunc("GET /api/setup/status", s.status)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if s.Store.db.PingContext(r.Context()) != nil {
			http.Error(w, "database unavailable", 503)
			return
		}
		jsonResponse(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /ops/monitor", s.monitor)
	mux.HandleFunc("GET /ops/notifications", s.notificationStatus)
	mux.HandleFunc("GET /ops/jobs", func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 || s.Config.OpsToken == "" {
			http.Error(w, "unauthorized", 401)
			return
		}
		jobs, err := s.Store.Jobs()
		if err != nil {
			http.Error(w, "unable to read jobs", 503)
			return
		}
		var out []map[string]any
		for _, j := range jobs {
			held, err := s.Store.Held(j.Subscription)
			if err != nil {
				http.Error(w, "unable to read billing state", 503)
				return
			}
			out = append(out, map[string]any{"id": j.ID, "state": j.State, "retired": j.Retired, "billing_review": held, "app": j.App, "slug": j.Slug, "attempts": j.Attempts, "error": j.Error, "updated_at": j.UpdatedAt, "domain_token_expires": j.TokenExpires,
				"suspended_at": j.Suspension.CompletedAt, "suspension_phase": j.Suspension.Phase, "suspension_attempts": j.Suspension.Attempts, "suspension_error": j.Suspension.Error,
				"domain_token_updated_at": j.DomainTokenUpdatedAt, "domain_update_phase": j.DomainRotation.Phase, "domain_update_attempts": j.DomainRotation.Attempts, "domain_update_error": j.DomainRotation.Error, "domain_update_next_at": j.DomainRotation.NextAt})
		}
		jsonResponse(w, 200, out)
	})
	mux.HandleFunc("GET /ops/credentials", func(w http.ResponseWriter, r *http.Request) {
		if s.Config.OpsToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 {
			http.Error(w, "unauthorized", 401)
			return
		}
		status, err := s.Store.CredentialStatus()
		if err != nil {
			http.Error(w, "credential status unavailable", 503)
			return
		}
		jobs, err := s.Store.Jobs()
		if err != nil {
			http.Error(w, "credential status unavailable", 503)
			return
		}
		pending, ready := 0, 0
		for _, j := range jobs {
			if j.Retired {
				continue
			}
			if j.State == "ready" {
				ready++
			}
			if j.DomainRotation.Phase != "" || (j.TokenExpires > 0 && j.DomainParentHash != hashToken(s.Config.FlyToken)) {
				pending++
			}
		}
		jsonResponse(w, 200, map[string]any{"status": status, "ready_customers": ready, "pending_parent_updates": pending, "previous_parent_updates_complete": status.CheckedAt > 0 && status.Error == "" && pending == 0})
	})
	mux.HandleFunc("GET /ops/backups", func(w http.ResponseWriter, r *http.Request) {
		if s.Config.OpsToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 {
			http.Error(w, "unauthorized", 401)
			return
		}
		status, err := s.Store.BackupStatus()
		if err != nil {
			http.Error(w, "backup status unavailable", 503)
			return
		}
		jsonResponse(w, 200, map[string]any{"enabled": s.Config.Backups.Enabled, "completed": status})
	})
	mux.HandleFunc("POST /ops/jobs/{id}/retire", func(w http.ResponseWriter, r *http.Request) {
		if s.Config.OpsToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 {
			http.Error(w, "unauthorized", 401)
			return
		}
		s.workerMu.Lock()
		defer s.workerMu.Unlock()
		j, err := s.Store.Get(r.PathValue("id"))
		if err != nil || j.State != "ready" {
			http.Error(w, "only a ready job can be retired", 409)
			return
		}
		if j.SMTPKeyID != "" {
			revoker, ok := s.Provisioner.(interface {
				RevokeSMTPKey(context.Context, *Job) error
			})
			if !ok {
				http.Error(w, "SMTP key revocation unavailable", 503)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
			defer cancel()
			if err := revoker.RevokeSMTPKey(ctx, &j); err != nil {
				http.Error(w, "SMTP key revocation failed; retirement not saved", 503)
				return
			}
		}
		// Retirement is bookkeeping for an operator-removed app; it never stops
		// Machines or deletes a customer's data, archives, DNS, or billing.
		j.Retired = true
		if s.Store.Save(j) != nil {
			http.Error(w, "unable to retire job", 503)
			return
		}
		w.WriteHeader(202)
	})
	mux.HandleFunc("POST /ops/jobs/{id}/retry", func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 || s.Config.OpsToken == "" {
			http.Error(w, "unauthorized", 401)
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		j, err := s.Store.Get(r.PathValue("id"))
		if err != nil || j.State != "attention" {
			http.Error(w, "job is not awaiting retry", 409)
			return
		}
		if held, err := s.Store.Held(j.Subscription); err != nil || held {
			http.Error(w, "billing review must be resolved first", 409)
			return
		}
		// Error stores only a phase name, never upstream response bodies or credentials.
		j.State, j.Error, j.Attempts, j.NextAt = j.Error, "", 0, s.now().Unix()
		j.StartedAt = s.now().Unix()
		if s.Store.Save(j) != nil {
			http.Error(w, "unable to retry", 503)
			return
		}
		w.WriteHeader(202)
	})
	mux.HandleFunc("POST /ops/jobs/{id}/resend", func(w http.ResponseWriter, r *http.Request) {
		if s.Config.OpsToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 {
			http.Error(w, "unauthorized", 401)
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		j, err := s.Store.Get(r.PathValue("id"))
		if err != nil || (j.State != "invite" && j.State != "awaiting_claim" && !(j.State == "attention" && j.Error == "invite")) {
			http.Error(w, "setup has already been claimed", 409)
			return
		}
		token, err := randomToken()
		if err != nil {
			http.Error(w, "unable to renew link", 503)
			return
		}
		j.ClaimSecret, err = s.Store.seal(j.ID+":claim", token)
		if err != nil {
			http.Error(w, "unable to renew link", 503)
			return
		}
		j.ClaimHash, j.ClaimExpires, j.State, j.Error, j.Attempts, j.NextAt = hashToken(token), s.now().Add(72*time.Hour).Unix(), "invite", "", 0, s.now().Unix()
		if s.Store.Save(j) != nil {
			http.Error(w, "unable to renew link", 503)
			return
		}
		w.WriteHeader(202)
	})
	files, _ := fs.Sub(assets, "assets")
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(files))))
	mux.HandleFunc("GET /setup", func(w http.ResponseWriter, r *http.Request) {
		raw, _ := assets.ReadFile("assets/setup.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(raw)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")
		mux.ServeHTTP(w, r)
	})
}

// Maintenance and signup provisioning share the same lock/lease so neither can
// overwrite the other's encrypted job checkpoint. Ready billing holds still keep
// serving by policy, so their domain credentials remain maintained as well.
func (s *Service) MaintainCredentials(ctx context.Context, owner string) error {
	s.workerMu.Lock()
	defer s.workerMu.Unlock()
	if s.Credentials == nil {
		return nil
	}
	s.Credentials.Lease = func() (bool, error) { return s.Store.Lease(owner, s.now()) }
	ok, err := s.Credentials.Lease()
	if err != nil || !ok {
		return err
	}
	return s.Credentials.Run(ctx)
}

// Tick performs one bounded, resumable step per job. The single worker and lease
// avoid double allocation; each adapter also reconciles existing resources first.
func (s *Service) Tick(ctx context.Context, owner string) error {
	s.workerMu.Lock()
	defer s.workerMu.Unlock()
	ok, err := s.Store.Lease(owner, s.now())
	if err != nil || !ok {
		return err
	}
	jobs, err := s.Store.Jobs()
	if err != nil {
		return err
	}
	for _, j := range jobs {
		if j.Retired {
			continue
		}
		if err := s.suspendIfDue(ctx, owner, &j); err != nil {
			return err
		}
		held, err := s.Store.Held(j.Subscription)
		if err != nil {
			return err
		}
		suspendAfter, err := s.Store.SuspendAfter(j.Subscription)
		if err != nil {
			return err
		}
		if (j.Attempts >= 3 || (held && suspendAfter == 0) || j.State == "attention" || j.Suspension.Attempts >= 3) && !j.Alerted && s.Config.AlertEmail != "" {
			mailCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			err = s.Mailer.Send(mailCtx, s.Config.AlertEmail, "Primo setup needs attention", "Signup "+j.ID+" needs review. Current step: "+j.State+". Check the private provisioning status endpoint. Customer details remain saved.", "primo-alert-"+j.ID)
			cancel()
			if err == nil {
				j.Alerted = true
				if err := s.Store.checkpoint(j, j.State); err != nil {
					return err
				}
			}
		}
		if held {
			continue
		}
		if j.State == "ready" || j.State == "attention" || j.State == "awaiting_claim" || j.NextAt > s.now().Unix() {
			continue
		}
		ok, err := s.Store.Lease(owner, s.now())
		if err != nil || !ok {
			return err
		}
		phase := j.State
		stepCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		if phase == "invite" {
			var token string
			token, err = s.Store.open(j.ID+":claim", j.ClaimSecret)
			if err == nil && j.ClaimExpires <= s.now().Unix() {
				err = errors.New("claim expired")
			}
			if err == nil {
				err = s.Mailer.Send(stepCtx, j.Email, "Set up your Primo server", "Choose your server name and password:\n\n"+s.Config.PublicURL+"/setup#"+token+"\n\nThis private link expires in 72 hours. If you didn't purchase Primo, ignore this email.", "primo-claim-"+j.ID+"-"+j.ClaimHash[:12])
			}
			if err == nil {
				j.State = "awaiting_claim"
			}
		} else if phase == "ready_email" {
			err = s.Mailer.Send(stepCtx, j.Email, "Your Primo server is ready", "Your dashboard is ready:\n\nhttps://"+j.Slug+"."+s.Config.Domain+"/admin/auth\n\nSign in with your purchase email and the password you chose.", "primo-ready-"+j.ID)
			if err == nil {
				j.State = "ready"
				j.ReadyAt = s.now().Unix()
			}
		} else {
			var creds Credentials
			var raw string
			raw, err = s.Store.open(j.ID+":credentials", j.Secrets)
			if err == nil {
				err = json.Unmarshal([]byte(raw), &creds)
			}
			if err == nil {
				err = s.Provisioner.Step(stepCtx, &j, &creds)
			}
			if err == nil {
				// Clear the customer's password after verification and bootstrap-secret removal.
				if j.State == "ready" || j.State == "ready_email" {
					creds.Password = ""
					creds.SMTPPassword = ""
				}
				var data []byte
				data, err = json.Marshal(creds)
				if err == nil {
					j.Secrets, err = s.Store.seal(j.ID+":credentials", string(data))
				}
			}
		}
		cancel()
		j.UpdatedAt = s.now().Unix()
		if errors.Is(err, errNotReady) && j.StartedAt > 0 && s.now().Unix() < j.StartedAt+20*60 {
			j.State, j.Error, j.NextAt = phase, "", s.now().Add(10*time.Second).Unix()
		} else if err != nil {
			// Keep the last checkpoint so retries repeat the failed step, never skip it.
			j.State = phase
			j.Attempts++
			j.Error = phase
			delay := time.Duration(1<<min(j.Attempts, 8)) * 5 * time.Second
			j.NextAt = s.now().Add(delay).Unix()
			if j.Attempts >= 12 || (j.StartedAt > 0 && s.now().Unix() >= j.StartedAt+20*60) {
				j.State = "attention"
			}
			slog.Warn("hosting step needs retry", "job", j.ID, "phase", phase, "attempt", j.Attempts)
		} else {
			j.Attempts = 0
			j.Error = ""
			j.NextAt = s.now().Unix()
		}
		if err := s.Store.checkpoint(j, phase); err != nil {
			return err
		}
		if _, err := s.Store.db.Exec("INSERT INTO worker_heartbeat VALUES(1,?) ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at", s.now().Unix()); err != nil {
			return err
		}
	}
	if err := s.deliverPurchaseNotification(ctx); err != nil {
		return err
	}
	_, err = s.Store.db.Exec("INSERT INTO worker_heartbeat VALUES(1,?) ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at", s.now().Unix())
	return err
}
