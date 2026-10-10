package hosting

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeProvisioner struct {
	calls int
	fail  bool
}

func (p *fakeProvisioner) CheckSlug(context.Context, string) error { return nil }
func (p *fakeProvisioner) Step(_ context.Context, j *Job, _ *Credentials) error {
	p.calls++
	if p.fail {
		return errors.New("upstream secret must never be exposed")
	}
	j.State = "ready_email"
	return nil
}

type fakeMailer struct {
	messages []string
	fail     bool
	during   func()
}

func (m *fakeMailer) Send(_ context.Context, to, subject, body, key string) error {
	if m.during != nil {
		fn := m.during
		m.during = nil
		fn()
	}
	if m.fail {
		return errors.New("mail unavailable")
	}
	m.messages = append(m.messages, to+"\n"+subject+"\n"+body+"\n"+key)
	return nil
}
func fixture(t *testing.T) (*Service, *fakeProvisioner, *fakeMailer) {
	t.Helper()
	key := bytes.Repeat([]byte{42}, 32)
	store, err := OpenStore(filepath.Join(t.TempDir(), "hosting.sqlite"), key)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	now := time.Date(2026, 10, 4, 22, 0, 0, 0, time.UTC)
	p, m := &fakeProvisioner{}, &fakeMailer{}
	s := &Service{Config: Config{PublicURL: "https://hosting.primo.page", Domain: "primo.page", WebhookSecret: "whsec_" + base64.StdEncoding.EncodeToString(key), WebhookScheme: "standard", Products: map[string]Plan{"maker-product": {Name: "Maker", Sites: 3}}, Cutover: now.Add(-time.Hour), OpsToken: strings.Repeat("x", 32)}, Store: store, Provisioner: p, Mailer: m, Now: func() time.Time { return now }}
	return s, p, m
}
func paidPayload(s *Service, reason, product, subscription string, created time.Time) []byte {
	raw, _ := json.Marshal(map[string]any{"type": "order.paid", "data": map[string]any{"id": "order-1", "paid": true, "created_at": created, "billing_reason": reason, "product_id": product, "subscription_id": subscription, "customer_id": "customer-1", "customer": map[string]string{"id": "customer-1", "email": "customer@example.com"}}})
	return raw
}
func signedRequest(s *Service, id string, raw []byte) *http.Request {
	r := httptest.NewRequest("POST", "/webhooks/polar", bytes.NewReader(raw))
	stamp := strconv.FormatInt(s.now().Unix(), 10)
	key := []byte(s.Config.WebhookSecret)
	if s.Config.WebhookScheme == "standard" {
		key, _ = base64.StdEncoding.DecodeString(strings.TrimPrefix(s.Config.WebhookSecret, "whsec_"))
	}
	h := hmac.New(sha256.New, key)
	h.Write([]byte(id + "." + stamp + "."))
	h.Write(raw)
	r.Header.Set("webhook-id", id)
	r.Header.Set("webhook-timestamp", stamp)
	r.Header.Set("webhook-signature", "v1,"+base64.StdEncoding.EncodeToString(h.Sum(nil)))
	return r
}
func enqueue(t *testing.T, s *Service) Job {
	t.Helper()
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, signedRequest(s, "event-1", paidPayload(s, "subscription_create", "maker-product", "subscription-1", s.now())))
	if w.Code != 202 {
		t.Fatalf("webhook=%d %s", w.Code, w.Body)
	}
	jobs, err := s.Store.Jobs()
	if err != nil || len(jobs) != 1 {
		t.Fatalf("jobs=%v err=%v", jobs, err)
	}
	return jobs[0]
}
func claimToken(t *testing.T, s *Service, j Job) string {
	t.Helper()
	token, err := s.Store.open(j.ID+":claim", j.ClaimSecret)
	if err != nil {
		t.Fatal(err)
	}
	return token
}
func claimRequest(s *Service, token, slug, password string) *http.Request {
	raw, _ := json.Marshal(map[string]string{"token": token, "slug": slug, "password": password})
	r := httptest.NewRequest("POST", "/api/setup/claim", bytes.NewReader(raw))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", s.Config.PublicURL)
	return r
}

func TestWebhookSignatureAndPaidOrderDeduplication(t *testing.T) {
	s, _, _ := fixture(t)
	raw := paidPayload(s, "subscription_create", "maker-product", "subscription-1", s.now())
	r := signedRequest(s, "event-1", raw)
	if !VerifyWebhook(s.Config.WebhookSecret, "standard", r.Header, raw, s.now()) {
		t.Fatal("standard signature rejected")
	}
	if VerifyWebhook(s.Config.WebhookSecret, "standard", r.Header, append(raw, ' '), s.now()) {
		t.Fatal("tampered body accepted")
	}
	if VerifyWebhook(s.Config.WebhookSecret, "standard", r.Header, raw, s.now().Add(6*time.Minute)) {
		t.Fatal("old replay accepted")
	}
	if VerifyWebhook(s.Config.WebhookSecret, "standard", r.Header, raw, s.now().Add(-6*time.Minute)) {
		t.Fatal("future signature accepted")
	}
	s.Config.WebhookScheme = "legacy"
	r = signedRequest(s, "event-legacy", raw)
	if !VerifyWebhook(s.Config.WebhookSecret, "legacy", r.Header, raw, s.now()) {
		t.Fatal("legacy Polar signature rejected")
	}
	if VerifyWebhook(s.Config.WebhookSecret, "standard", r.Header, raw, s.now()) {
		t.Fatal("signature scheme ignored")
	}
	j := enqueue(t, s)
	for _, id := range []string{"event-1", "different-delivery"} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, signedRequest(s, id, raw))
		if w.Code != 202 {
			t.Fatal(w.Code)
		}
	}
	jobs, _ := s.Store.Jobs()
	if len(jobs) != 1 || jobs[0].ID != j.ID {
		t.Fatal("duplicate order created another job")
	}
}
func TestRenewalsUnsupportedPlansAndHistoricalOrdersNeverProvision(t *testing.T) {
	for _, test := range []struct {
		reason, product string
		historical      bool
	}{{"subscription_cycle", "maker-product", false}, {"subscription_update", "maker-product", false}, {"purchase", "maker-product", false}, {"subscription_create", "agency-product", false}, {"subscription_create", "maker-product", true}} {
		t.Run(test.reason+test.product+strconv.FormatBool(test.historical), func(t *testing.T) {
			s, p, _ := fixture(t)
			at := s.now()
			if test.historical {
				at = s.Config.Cutover.Add(-time.Second)
			}
			w := httptest.NewRecorder()
			s.Handler().ServeHTTP(w, signedRequest(s, "event", paidPayload(s, test.reason, test.product, "sub", at)))
			if w.Code != 202 {
				t.Fatal(w.Code)
			}
			s.Tick(context.Background(), "worker")
			jobs, _ := s.Store.Jobs()
			if len(jobs) != 0 || p.calls != 0 {
				t.Fatal("non-signup event provisioned a server")
			}
		})
	}
}
func TestClaimIsSingleUseEmailBoundEncryptedAndResumable(t *testing.T) {
	s, p, m := fixture(t)
	j := enqueue(t, s)
	token := claimToken(t, s, j)
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.messages) != 1 || !strings.Contains(m.messages[0], "customer@example.com") || !strings.Contains(m.messages[0], "/setup#"+token) {
		t.Fatal("private link not sent to purchaser")
	}
	handler := s.Handler()
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, claimRequest(s, token, "customer-one", "long customer password"))
	if w.Code != 202 {
		t.Fatalf("claim %d %s", w.Code, w.Body)
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("unsafe setup cookie")
	}
	for _, again := range []bool{true, false} {
		againW := httptest.NewRecorder()
		request := claimRequest(s, token, "customer-two", "another good password")
		if !again {
			request.Header.Set("Origin", "https://evil.example")
		}
		handler.ServeHTTP(againW, request)
		if againW.Code != 403 {
			t.Fatal("reused link or cross-origin claim accepted")
		}
	}
	stored, err := s.Store.Get(j.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Email != "customer@example.com" || stored.ClaimSecret != "" || stored.ClaimHash != "" {
		t.Fatal("claim identity changed or private link retained")
	}
	var raw string
	s.Store.db.QueryRow("SELECT payload FROM jobs WHERE id=?", j.ID).Scan(&raw)
	for _, value := range []string{token, "customer@example.com", "long customer password"} {
		if strings.Contains(raw, value) {
			t.Fatal("sensitive state stored in plaintext")
		}
	}
	p.fail = true
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	stored, _ = s.Store.Get(j.ID)
	if stored.State != "app" || stored.Attempts != 1 {
		t.Fatal("failed step lost checkpoint")
	}
	// Reopen the actual database to prove a process restart preserves queued work.
	filename := s.Config.Database
	if filename == "" {
		s.Store.db.QueryRow("PRAGMA database_list").Scan(new(int), new(string), &filename)
	}
	s.Store.Close()
	reopened, err := OpenStore(filename, bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	s.Store = reopened
	t.Cleanup(func() { reopened.Close() })
	stored, _ = s.Store.Get(j.ID)
	stored.NextAt = s.now().Unix()
	s.Store.Save(stored)
	p.fail = false
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	stored, _ = s.Store.Get(j.ID)
	if stored.State != "ready" {
		t.Fatalf("state=%s", stored.State)
	}
	creds, err := s.Store.open(j.ID+":credentials", stored.Secrets)
	if err != nil || strings.Contains(creds, "long customer password") {
		t.Fatal("customer password not discarded")
	}
	status := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/setup/status", nil)
	req.AddCookie(cookies[0])
	handler.ServeHTTP(status, req)
	if status.Code != 200 || !strings.Contains(status.Body.String(), `"state":"ready"`) || strings.Contains(status.Body.String(), "AdminPassword") {
		t.Fatal("unsafe or missing status")
	}
	if len(m.messages) != 2 {
		t.Fatal("ready email not sent exactly once")
	}
}
func TestConcurrentClaimsAndExpiredLinks(t *testing.T) {
	s, _, _ := fixture(t)
	j := enqueue(t, s)
	token := claimToken(t, s, j)
	var wg sync.WaitGroup
	results := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := httptest.NewRecorder()
			s.Handler().ServeHTTP(w, claimRequest(s, token, "same-name", "a sufficiently long password"))
			results <- w.Code
		}()
	}
	wg.Wait()
	close(results)
	accepted := 0
	for code := range results {
		if code == 202 {
			accepted++
		} else if code != 403 {
			t.Fatal(code)
		}
	}
	if accepted != 1 {
		t.Fatal("concurrent claims both succeeded")
	}
	s2, _, _ := fixture(t)
	expired := enqueue(t, s2)
	expired.ClaimExpires = s2.now().Add(-time.Second).Unix()
	s2.Store.Save(expired)
	w := httptest.NewRecorder()
	s2.Handler().ServeHTTP(w, claimRequest(s2, claimToken(t, s2, expired), "other-name", "long enough password"))
	if w.Code != 403 {
		t.Fatal("expired setup link accepted")
	}
}
func TestClaimDuringMailDeliveryCannotBeOverwrittenByWorker(t *testing.T) {
	s, _, m := fixture(t)
	j := enqueue(t, s)
	token := claimToken(t, s, j)
	m.during = func() {
		_, err := s.Store.Claim(token, "claimed-name", "long enough password", strings.Repeat("a", 43), s.now())
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	stored, _ := s.Store.Get(j.ID)
	if stored.State != "app" || stored.ClaimHash != "" {
		t.Fatal("worker restored a consumed setup link")
	}
}
func TestLeaseAndBillingHoldBeforePaidDelivery(t *testing.T) {
	s, p, _ := fixture(t)
	raw := []byte(`{"type":"subscription.revoked","data":{"id":"subscription-1"}}`)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, signedRequest(s, "revoked-first", raw))
	if w.Code != 202 {
		t.Fatal(w.Code)
	}
	j := enqueue(t, s)
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	stored, _ := s.Store.Get(j.ID)
	if stored.State != "invite" || p.calls != 0 {
		t.Fatal("revoked purchase provisioned")
	}
	ok, err := s.Store.Lease("other-worker", s.now())
	if err != nil || ok {
		t.Fatal("worker lease permits concurrent workers")
	}
	ok, err = s.Store.Lease("other-worker", s.now().Add(6*time.Minute))
	if err != nil || !ok {
		t.Fatal("crashed worker lease never expires")
	}
}
func TestSlugValidationAndPrivateEndpoints(t *testing.T) {
	for _, slug := range []string{"admin", "www", "fly-smoke", "a", "1name", "Uppercase", "bad..name", "bad--name", "-bad", "bad-", "../../evil", "a b"} {
		if ValidSlug(slug) {
			t.Fatalf("unsafe slug accepted: %s", slug)
		}
	}
	if !ValidSlug("my-server-2") {
		t.Fatal("valid slug rejected")
	}
	s, _, _ := fixture(t)
	for _, path := range []string{"/api/setup/status", "/ops/jobs"} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 401 {
			t.Fatalf("private endpoint %s=%d", path, w.Code)
		}
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/setup", nil))
	if w.Code != 200 || w.Header().Get("Referrer-Policy") != "no-referrer" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("setup page security headers missing")
	}
	jobs, _ := s.Store.Jobs()
	if len(jobs) != 0 {
		t.Fatal("visiting setup allocated a server")
	}
	var filename string
	s.Store.db.QueryRow("PRAGMA database_list").Scan(new(int), new(string), &filename)
	stat, err := os.Stat(filename)
	if err != nil || stat.Mode().Perm() != 0600 {
		t.Fatal("unsafe database permissions")
	}
}

func TestLocalTokenDerivationCanRetryAfterWorkerFailure(t *testing.T) {
	s, p, _ := fixture(t)
	j := enqueue(t, s)
	token := claimToken(t, s, j)
	if _, err := s.Store.Claim(token, "review-server", "long enough password", strings.Repeat("s", 43), s.now()); err != nil {
		t.Fatal(err)
	}
	j, _ = s.Store.Get(j.ID)
	j.State = "token"
	s.Store.Save(j)
	p.fail = true
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	j, _ = s.Store.Get(j.ID)
	if j.State != "token" || j.Error != "token" || p.calls != 1 {
		t.Fatal("local credential derivation did not checkpoint a retry")
	}
	p.fail = false
	j.NextAt = 0
	s.Store.Save(j)
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	j, _ = s.Store.Get(j.ID)
	if j.State != "ready_email" || p.calls != 2 {
		t.Fatal("credential retry did not resume")
	}
}

func TestResendRotatesUnclaimedInvitation(t *testing.T) {
	s, _, m := fixture(t)
	j := enqueue(t, s)
	original := claimToken(t, s, j)
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/ops/jobs/"+j.ID+"/resend", nil)
	req.Header.Set("Authorization", "Bearer "+s.Config.OpsToken)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != 202 {
		t.Fatal(w.Code)
	}
	j, _ = s.Store.Get(j.ID)
	renewed := claimToken(t, s, j)
	if renewed == original {
		t.Fatal("private link not rotated")
	}
	if _, err := s.findClaim(original); !errors.Is(err, ErrClaim) {
		t.Fatal("old link remained valid")
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.messages) != 2 || !strings.Contains(m.messages[1], renewed) {
		t.Fatal("replacement link not delivered")
	}
}
