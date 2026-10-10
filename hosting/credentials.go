package hosting

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// The pending token is inside the encrypted job payload, never operator output.
// Each external side effect has its own checkpoint so a retry can reconcile it.
type DomainRotation struct {
	Phase, ParentHash, Token string
	Expires                  int64
	SecretsVersion           uint64
	Attempts                 int
	NextAt                   int64
	Error                    string
}

type CredentialStatus struct {
	CheckedAt         int64  `json:"checked_at"`
	FlyExpires        int64  `json:"fly_expires"`
	CloudflareExpires int64  `json:"cloudflare_expires"`
	Error             string `json:"error,omitempty"`
	ParentHash        string `json:"-"`
}

type DomainCredentialProvider interface {
	ParentExpiry(context.Context, time.Time) (int64, error)
	CloudflareExpiry(context.Context) (int64, error)
	RotateDomainToken(context.Context, *Job) error
}

type CredentialManager struct {
	Config   Config
	Store    *Store
	Provider DomainCredentialProvider
	Mailer   Mailer
	Now      func() time.Time
	// The service holds workerMu and its database lease while running this manager.
	Lease  func() (bool, error)
	status CredentialStatus
}

func (m *CredentialManager) now() time.Time {
	if m.Now != nil {
		return m.Now()
	}
	return time.Now()
}
func (s *Store) CredentialStatus() (CredentialStatus, error) {
	var raw []byte
	var status CredentialStatus
	err := s.db.QueryRow("SELECT payload FROM credential_status WHERE id=1").Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return status, nil
	}
	if err != nil {
		return status, err
	}
	err = json.Unmarshal(raw, &status)
	return status, err
}
func (m *CredentialManager) saveStatus() error {
	// ParentHash is only a cache key, intentionally omitted from the public status.
	raw, err := json.Marshal(m.status)
	if err != nil {
		return err
	}
	_, err = m.Store.db.Exec("INSERT INTO credential_status VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", raw)
	return err
}
func (m *CredentialManager) alert(ctx context.Context, key, body string) error {
	if m.Mailer == nil || m.Config.AlertEmail == "" {
		return errors.New("credential alert recipient unavailable")
	}
	var count int
	if err := m.Store.db.QueryRow("SELECT COUNT(*) FROM credential_alerts WHERE key=?", key).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	mailCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := m.Mailer.Send(mailCtx, m.Config.AlertEmail, "Primo domain credentials need attention", body, key); err != nil {
		return errors.New("credential alert delivery failed")
	}
	_, err := m.Store.db.Exec("INSERT INTO credential_alerts VALUES(?,?) ON CONFLICT DO NOTHING", key, m.now().Unix())
	return err
}
func (m *CredentialManager) expiryAlert(ctx context.Context, target string, expiry int64) error {
	now := m.now()
	if expiry == 0 || expiry > now.Add(30*24*time.Hour).Unix() {
		return nil
	}
	threshold := 30
	for _, days := range []int{14, 7, 1, 0} {
		if expiry <= now.Add(time.Duration(days)*24*time.Hour).Unix() {
			threshold = days
		}
	}
	key := fmt.Sprintf("primo-credential-expiry-%s-%d-%d", target, expiry, threshold)
	body := fmt.Sprintf("The %s credential expires at %s. Replace the central provider credential before expiry. Customer domain keys are updated automatically after the Fly parent is replaced; do not revoke the old parent until all active customer updates are verified. Review /ops/credentials and /ops/jobs. Existing customer data is retained.", target, time.Unix(expiry, 0).UTC().Format(time.RFC3339))
	return m.alert(ctx, key, body)
}

var errCredentialWaiting = errors.New("customer Machine is stopped or not ready")

func (m *CredentialManager) Run(ctx context.Context) error {
	now := m.now()
	var alertFailure error
	parentHash := hashToken(m.Config.FlyToken)
	if m.status.CheckedAt == 0 || m.status.ParentHash != parentHash || m.status.CheckedAt <= now.Add(-time.Hour).Unix() || m.status.Error != "" {
		m.status = CredentialStatus{CheckedAt: now.Unix(), ParentHash: parentHash}
		checkCtx, cancel := context.WithTimeout(ctx, time.Minute)
		flyExpiry, flyErr := m.Provider.ParentExpiry(checkCtx, now)
		cfExpiry, cfErr := m.Provider.CloudflareExpiry(checkCtx)
		cancel()
		m.status.FlyExpires, m.status.CloudflareExpires = flyExpiry, cfExpiry
		if flyErr != nil || cfErr != nil {
			m.status.Error = "provider_check_failed"
		}
		if err := m.saveStatus(); err != nil {
			return err
		}
	}
	if m.status.Error != "" {
		if err := m.alert(ctx, "primo-credential-check-"+now.UTC().Format("2006-01-02"), "The signup service could not verify its Fly or Cloudflare credential. Review /ops/credentials and provider access. Automatic updates will retry; no customer data was deleted."); err != nil {
			alertFailure = errors.Join(alertFailure, err)
		}
	}
	for _, item := range []struct {
		target string
		expiry int64
	}{{"Fly parent", m.status.FlyExpires}, {"Cloudflare DNS", m.status.CloudflareExpires}} {
		if err := m.expiryAlert(ctx, item.target, item.expiry); err != nil {
			alertFailure = errors.Join(alertFailure, err)
		}
	}
	jobs, err := m.Store.Jobs()
	if err != nil {
		return err
	}
	for _, j := range jobs {
		if j.Retired || j.State != "ready" || j.Suspension.Phase != "" || j.Suspension.CompletedAt > 0 {
			continue
		}
		if err := m.expiryAlert(ctx, "customer-"+j.ID, j.TokenExpires); err != nil {
			alertFailure = errors.Join(alertFailure, err)
		}
		if m.status.FlyExpires <= now.Add(5*time.Minute).Unix() {
			continue
		}
		// Reissue under a new parent, or when a ceiling-limited child can be extended.
		due := j.DomainParentHash != parentHash || (j.TokenExpires <= now.Add(30*24*time.Hour).Unix() && m.status.FlyExpires > j.TokenExpires+24*3600)
		if j.DomainRotation.Phase == "" && !due {
			continue
		}
		if j.DomainRotation.ParentHash != "" && j.DomainRotation.ParentHash != parentHash {
			// A second parent rotation supersedes any incomplete update. The old encrypted
			// credential remains retained until the new one is verified on the Machine.
			j.DomainRotation = DomainRotation{}
		}
		if j.DomainRotation.NextAt > now.Unix() {
			continue
		}
		if m.Lease != nil {
			ok, err := m.Lease()
			if err != nil || !ok {
				return err
			}
		}
		if j.DomainRotation.Phase == "" {
			j.DomainRotation = DomainRotation{Phase: "issue", ParentHash: parentHash}
			if err := m.Store.Save(j); err != nil {
				return err
			}
			continue
		}
		stepCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		phase := j.DomainRotation.Phase
		err = m.Provider.RotateDomainToken(stepCtx, &j)
		cancel()
		j.UpdatedAt = now.Unix()
		if errors.Is(err, errCredentialWaiting) {
			j.DomainRotation.Error = "waiting_for_machine"
			j.DomainRotation.NextAt = now.Add(time.Minute).Unix()
		} else if err != nil {
			// Keep the prior phase and previously verified credential on all failures.
			j.DomainRotation.Phase = phase
			j.DomainRotation.Attempts++
			j.DomainRotation.Error = "update_failed"
			j.DomainRotation.NextAt = now.Add(time.Duration(1<<min(j.DomainRotation.Attempts, 8)) * time.Minute).Unix()
			if j.DomainRotation.Attempts >= 3 {
				key := "primo-domain-update-" + j.ID + "-" + parentHash[:12] + "-" + now.UTC().Format("2006-01-02")
				if alertErr := m.alert(ctx, key, "Customer "+j.ID+" has an incomplete domain credential update. The saved phase will retry automatically. Review /ops/jobs; do not revoke the old Fly parent until this update is verified."); alertErr != nil {
					alertFailure = errors.Join(alertFailure, alertErr)
				}
			}
		} else {
			j.DomainRotation.Attempts = 0
			j.DomainRotation.Error = ""
			j.DomainRotation.NextAt = now.Unix()
			if j.DomainRotation.Phase == "complete" {
				raw, openErr := m.Store.open(j.ID+":credentials", j.Secrets)
				var creds Credentials
				if openErr != nil || json.Unmarshal([]byte(raw), &creds) != nil {
					return errors.New("customer credentials unavailable")
				}
				creds.DomainToken = j.DomainRotation.Token
				data, _ := json.Marshal(creds)
				j.Secrets, err = m.Store.seal(j.ID+":credentials", string(data))
				if err != nil {
					return err
				}
				j.TokenExpires = j.DomainRotation.Expires
				j.DomainParentHash = j.DomainRotation.ParentHash
				j.DomainTokenUpdatedAt = now.Unix()
				j.DomainRotation = DomainRotation{}
			}
		}
		if err := m.Store.Save(j); err != nil {
			return err
		}
	}
	return alertFailure
}

func (p *FlyProvisioner) ParentExpiry(ctx context.Context, now time.Time) (int64, error) {
	raw, err := p.Run(ctx, "", "tokens", "debug")
	if err != nil {
		return 0, err
	}
	return tokenMetadataExpiry(raw, now)
}
func (p *FlyProvisioner) CloudflareExpiry(ctx context.Context) (int64, error) {
	var out struct {
		Success bool `json:"success"`
		Result  struct {
			Status  string    `json:"status"`
			Expires time.Time `json:"expires_on"`
		} `json:"result"`
	}
	err := request(ctx, p.Client, "GET", p.CloudflareEndpoint+"/user/tokens/verify", p.Config.CloudflareToken, nil, &out)
	if err != nil {
		return 0, err
	}
	if !out.Success || out.Result.Status != "active" || out.Result.Expires.IsZero() {
		return 0, errors.New("DNS credential validity missing")
	}
	return out.Result.Expires.Unix(), nil
}
func (p *FlyProvisioner) customerMachine(ctx context.Context, j *Job) (machine, error) {
	var m machine
	err := p.fly(ctx, "GET", appPath(j)+"/machines/"+j.Machine, nil, &m)
	if err != nil {
		return m, err
	}
	if m.ID != j.Machine || m.Name != "primo-"+j.ID || m.InstanceID == "" {
		return m, errors.New("customer Machine identity mismatch")
	}
	raw, _ := json.Marshal(m.Config)
	var config struct {
		Env    map[string]string `json:"env"`
		Mounts []struct {
			Volume string `json:"volume"`
			Path   string `json:"path"`
		} `json:"mounts"`
	}
	if json.Unmarshal(raw, &config) != nil || config.Env["PRIMO_HOSTED_MODE"] != "true" || config.Env["PRIMO_DOMAIN_PROVIDER"] != "fly" || config.Env["PRIMO_FLY_TOKEN"] != "" || len(config.Mounts) != 1 || config.Mounts[0].Volume != j.Volume || config.Mounts[0].Path != "/app/pb_data" {
		return m, errors.New("customer Machine configuration mismatch")
	}
	return m, nil
}
func (p *FlyProvisioner) rotationMachine(ctx context.Context, j *Job) (machine, error) {
	m, err := p.customerMachine(ctx, j)
	if err == nil && m.State != "started" {
		err = fmt.Errorf("customer Machine state %s: %w", m.State, errCredentialWaiting)
	}
	return m, err
}
func (p *FlyProvisioner) tokenLoaded(ctx context.Context, j *Job, headers map[string]string) (bool, error) {
	var out struct {
		ExitCode int    `json:"exit_code"`
		Stdout   string `json:"stdout"`
	}
	err := requestHeaders(ctx, p.Client, "POST", p.FlyEndpoint+appPath(j)+"/machines/"+j.Machine+"/exec", p.Config.FlyToken, headers, map[string]any{"cmd": "sh -c 'printf %s \"$PRIMO_FLY_TOKEN\" | sha256sum'", "timeout": 10}, &out)
	if err != nil {
		return false, err
	}
	fields := strings.Fields(out.Stdout)
	if out.ExitCode != 0 || len(fields) != 2 || len(fields[0]) != 64 {
		return false, errors.New("customer credential fingerprint unavailable")
	}
	return fields[0] == hashToken(j.DomainRotation.Token), nil
}
func (p *FlyProvisioner) RotateDomainToken(ctx context.Context, j *Job) error {
	if j.State != "ready" || j.Retired || len(j.ID) != 24 || j.App != "primo-c-"+j.ID || j.Machine == "" || j.Volume == "" || j.DomainRotation.ParentHash != hashToken(p.Config.FlyToken) {
		return errors.New("invalid customer credential target")
	}
	r := &j.DomainRotation
	switch r.Phase {
	case "issue":
		token, expiry, err := p.appToken(ctx, j)
		if err != nil {
			return err
		}
		r.Token, r.Expires, r.Phase = token, expiry, "secrets"
	case "secrets":
		if r.Token == "" || r.Token == p.Config.FlyToken {
			return errors.New("restricted credential missing")
		}
		var out struct {
			Version uint64 `json:"version"`
		}
		if err := p.fly(ctx, "POST", appPath(j)+"/secrets", map[string]any{"values": map[string]string{"PRIMO_FLY_TOKEN": r.Token}}, &out); err != nil {
			return err
		}
		if out.Version == 0 {
			return errors.New("credential secrets version missing")
		}
		r.SecretsVersion, r.Phase = out.Version, "apply"
	case "apply":
		if r.SecretsVersion == 0 || r.Token == "" {
			return errors.New("pending credential checkpoint missing")
		}
		path := appPath(j) + "/machines/" + j.Machine
		// Fly exec takes its own Machine lease, so inspect the running key before
		// acquiring our update lease. A lost update response is reconciled here.
		if _, err := p.rotationMachine(ctx, j); err != nil {
			return err
		}
		loaded, err := p.tokenLoaded(ctx, j, nil)
		if err != nil {
			return err
		}
		if loaded {
			r.Phase = "verify"
			return nil
		}
		// A short provider lease protects the stopped-state check and configuration
		// update from racing a manual stop or deployment. Version matching avoids
		// overwriting a concurrent configuration change.
		var lease struct {
			Data struct {
				Nonce string `json:"nonce"`
			} `json:"data"`
		}
		if err := p.fly(ctx, "POST", path+"/lease", map[string]any{"description": "Primo domain credential update", "ttl": 150}, &lease); err != nil {
			return err
		}
		if lease.Data.Nonce == "" {
			return errors.New("customer Machine lease missing")
		}
		headers := map[string]string{"fly-machine-lease-nonce": lease.Data.Nonce}
		defer func() {
			releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			requestHeaders(releaseCtx, p.Client, "DELETE", p.FlyEndpoint+path+"/lease", p.Config.FlyToken, headers, nil, nil)
		}()
		m, err := p.rotationMachine(ctx, j)
		if err != nil {
			return err
		}
		if err := requestHeaders(ctx, p.Client, "POST", p.FlyEndpoint+path, p.Config.FlyToken, headers, map[string]any{"config": m.Config, "current_version": m.InstanceID, "min_secrets_version": r.SecretsVersion}, nil); err != nil {
			return err
		}
		r.Phase = "verify"
	case "verify":
		if _, err := p.rotationMachine(ctx, j); err != nil {
			return err
		}
		loaded, err := p.tokenLoaded(ctx, j, nil)
		if err != nil {
			return err
		}
		if !loaded {
			return errors.New("customer credential did not load")
		}
		var info struct {
			Hosted   bool   `json:"hosted_mode"`
			Provider string `json:"domain_provider"`
		}
		var execOut struct {
			ExitCode int    `json:"exit_code"`
			Stdout   string `json:"stdout"`
		}
		if err := p.fly(ctx, "POST", appPath(j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": "wget -q -O - http://127.0.0.1:8080/api/primo/info", "timeout": 10}, &execOut); err != nil {
			return errCredentialWaiting
		}
		if execOut.ExitCode != 0 || json.Unmarshal([]byte(execOut.Stdout), &info) != nil || !info.Hosted || info.Provider != "fly" {
			return errors.New("customer health check failed")
		}
		var app struct {
			Name string `json:"name"`
		}
		if err := request(ctx, p.Client, "GET", p.FlyEndpoint+appPath(j), r.Token, nil, &app); err != nil {
			return err
		}
		if app.Name != j.App {
			return errors.New("customer domain credential identity mismatch")
		}
		r.Phase = "complete"
	default:
		return errors.New("unknown domain credential update phase")
	}
	return nil
}
