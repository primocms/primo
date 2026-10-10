package hosting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fakeCredentialProvider struct {
	now       time.Time
	calls     int
	failPhase string
	waiting   bool
	parentErr bool
	expires   int64
}

func (p *fakeCredentialProvider) ParentExpiry(context.Context, time.Time) (int64, error) {
	if p.parentErr {
		return 0, errors.New("private parent secret")
	}
	if p.expires != 0 {
		return p.expires, nil
	}
	return p.now.Add(365 * 24 * time.Hour).Unix(), nil
}
func (p *fakeCredentialProvider) CloudflareExpiry(context.Context) (int64, error) {
	return p.now.Add(365 * 24 * time.Hour).Unix(), nil
}
func (p *fakeCredentialProvider) RotateDomainToken(_ context.Context, j *Job) error {
	p.calls++
	if p.waiting {
		return errCredentialWaiting
	}
	if j.DomainRotation.Phase == p.failPhase {
		return errors.New("sensitive provider response")
	}
	switch j.DomainRotation.Phase {
	case "issue":
		j.DomainRotation.Token = "FlyV1 app-only-replacement"
		j.DomainRotation.Expires = p.now.Add(365 * 24 * time.Hour).Unix()
		j.DomainRotation.Phase = "secrets"
	case "secrets":
		j.DomainRotation.SecretsVersion = 42
		j.DomainRotation.Phase = "apply"
	case "apply":
		j.DomainRotation.Phase = "verify"
	case "verify":
		j.DomainRotation.Phase = "complete"
	default:
		return errors.New("invalid phase")
	}
	return nil
}
func credentialFixture(t *testing.T) (*Service, *CredentialManager, *fakeCredentialProvider, *fakeMailer, string, Job) {
	t.Helper()
	s, _, mail := fixture(t)
	filename := filepath.Join(t.TempDir(), "credentials.sqlite")
	s.Store.Close()
	store, err := OpenStore(filename, bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	s.Store = store
	t.Cleanup(func() { store.Close() })
	s.Config.FlyToken = "FlyV1 parent-replacement"
	s.Config.AlertEmail = "operator@example.com"
	provider := &fakeCredentialProvider{now: s.now()}
	manager := &CredentialManager{Config: s.Config, Store: store, Provider: provider, Mailer: mail, Now: s.Now}
	s.Credentials = manager
	j := Job{ID: strings.Repeat("a", 24), Subscription: "rotation-sub", State: "ready", App: "primo-c-" + strings.Repeat("a", 24), Slug: "rotation-test", Volume: "v", Machine: "m", DomainParentHash: hashToken("FlyV1 old-parent"), TokenExpires: s.now().Add(90 * 24 * time.Hour).Unix()}
	data, _ := json.Marshal(Credentials{DomainToken: "FlyV1 original-child", AdminPassword: "support-secret"})
	j.Secrets, err = store.seal(j.ID+":credentials", string(data))
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Accept("rotation-event", "test", "ready", &j); err != nil {
		t.Fatal(err)
	}
	return s, manager, provider, mail, filename, j
}
func runCredentials(t *testing.T, s *Service) {
	t.Helper()
	if err := s.MaintainCredentials(context.Background(), "test-owner"); err != nil {
		t.Fatal(err)
	}
}
func credentialsOf(t *testing.T, s *Store, j Job) Credentials {
	t.Helper()
	raw, err := s.open(j.ID+":credentials", j.Secrets)
	if err != nil {
		t.Fatal(err)
	}
	var c Credentials
	if json.Unmarshal([]byte(raw), &c) != nil {
		t.Fatal("credentials invalid")
	}
	return c
}
func TestDomainCredentialRotationSurvivesRestartAndCommitsAfterVerification(t *testing.T) {
	s, m, p, _, filename, j := credentialFixture(t)
	runCredentials(t, s)
	runCredentials(t, s)
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "secrets" || credentialsOf(t, s.Store, saved).DomainToken != "FlyV1 original-child" {
		t.Fatal("replaced verified token before Machine verification")
	}
	raw, _ := os.ReadFile(filename)
	if bytes.Contains(raw, []byte(saved.DomainRotation.Token)) {
		t.Fatal("pending token exposed in database")
	}
	s.Store.Close()
	reopened, err := OpenStore(filename, bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s.Store = reopened
	s.Credentials = &CredentialManager{Config: m.Config, Store: reopened, Provider: p, Mailer: m.Mailer, Now: s.Now}
	for i := 0; i < 3; i++ {
		runCredentials(t, s)
	}
	saved, _ = s.Store.Get(j.ID)
	c := credentialsOf(t, s.Store, saved)
	if saved.DomainRotation.Phase != "" || saved.DomainParentHash != hashToken(s.Config.FlyToken) || saved.DomainTokenUpdatedAt == 0 || c.DomainToken != "FlyV1 app-only-replacement" || c.AdminPassword != "support-secret" || c.Password != "" {
		t.Fatal("verified update did not commit correctly")
	}
	calls := p.calls
	runCredentials(t, s)
	if p.calls != calls {
		t.Fatal("healthy current credential rotated repeatedly")
	}
}
func TestDomainCredentialFailureRetriesSavedPhaseAndAlertsWithoutSecrets(t *testing.T) {
	s, _, p, mail, _, j := credentialFixture(t)
	runCredentials(t, s)
	runCredentials(t, s)
	p.failPhase = "secrets"
	for i := 0; i < 3; i++ {
		runCredentials(t, s)
		now := s.now().Add(10 * time.Hour)
		s.Now = func() time.Time { return now }
		s.Credentials.Now = s.Now
	}
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "secrets" || saved.DomainRotation.Attempts != 3 || saved.DomainRotation.Error != "update_failed" || credentialsOf(t, s.Store, saved).DomainToken != "FlyV1 original-child" {
		t.Fatal("failure skipped checkpoint or discarded original credential")
	}
	if len(mail.messages) != 1 || strings.Contains(mail.messages[0], "sensitive provider response") || strings.Contains(mail.messages[0], saved.DomainRotation.Token) {
		t.Fatal("alert missing or exposed credentials")
	}
	p.failPhase = ""
	now := s.now().Add(time.Hour)
	s.Now = func() time.Time { return now }
	s.Credentials.Now = s.Now
	for i := 0; i < 3; i++ {
		runCredentials(t, s)
	}
	saved, _ = s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "" {
		t.Fatal("retry did not recover")
	}
}
func TestDomainMaintenanceSkipsRetiredAndNeverCompletesStoppedMachine(t *testing.T) {
	s, _, p, _, _, j := credentialFixture(t)
	j.Retired = true
	s.Store.Save(j)
	runCredentials(t, s)
	if p.calls != 0 {
		t.Fatal("retired job changed")
	}
	j.Retired = false
	s.Store.Save(j)
	runCredentials(t, s)
	p.waiting = true
	runCredentials(t, s)
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "issue" || saved.DomainRotation.Error != "waiting_for_machine" || saved.DomainRotation.Attempts != 0 || saved.DomainParentHash == hashToken(s.Config.FlyToken) {
		t.Fatal("stopped Machine marked updated")
	}
}
func TestCredentialExpiryAlertsPersistAndRetryFailedMail(t *testing.T) {
	s, m, p, mail, _, j := credentialFixture(t)
	j.Retired = true
	s.Store.Save(j)
	p.expires = s.now().Add(20 * 24 * time.Hour).Unix()
	mail.fail = true
	if err := s.MaintainCredentials(context.Background(), "test-owner"); err == nil {
		t.Fatal("failed mail ignored")
	}
	mail.fail = false
	runCredentials(t, s)
	if len(mail.messages) != 1 {
		t.Fatal("expiry alert missing")
	}
	s.Credentials = &CredentialManager{Config: m.Config, Store: m.Store, Provider: p, Mailer: mail, Now: s.Now}
	runCredentials(t, s)
	if len(mail.messages) != 1 {
		t.Fatal("restart duplicated expiry alert")
	}
	now := s.now().Add(14 * 24 * time.Hour)
	s.Now = func() time.Time { return now }
	s.Credentials.Now = s.Now
	runCredentials(t, s)
	if len(mail.messages) != 2 {
		t.Fatal("7-day escalation missing")
	}
}
func TestCredentialOpsRequireAuthenticationAndExcludePendingSecret(t *testing.T) {
	s, _, _, _, _, j := credentialFixture(t)
	runCredentials(t, s)
	runCredentials(t, s)
	for _, path := range []string{"/ops/credentials", "/ops/jobs"} {
		req := httptest.NewRequest("GET", path, nil)
		out := httptest.NewRecorder()
		s.Handler().ServeHTTP(out, req)
		if out.Code != 401 {
			t.Fatal("operator status public")
		}
		req.Header.Set("Authorization", "Bearer "+s.Config.OpsToken)
		out = httptest.NewRecorder()
		s.Handler().ServeHTTP(out, req)
		if out.Code != 200 || strings.Contains(out.Body.String(), "FlyV1") || strings.Contains(out.Body.String(), "support-secret") || strings.Contains(out.Body.String(), "ParentHash") {
			t.Fatal("operator status leaked secret")
		}
	}
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Token == "" {
		t.Fatal("test did not stage a pending token")
	}
}

func TestFlyRotationReconcilesLostUpdateAndPreservesStoppedState(t *testing.T) {
	for _, stopped := range []bool{false, true} {
		t.Run(fmtBool(stopped), func(t *testing.T) {
			id := strings.Repeat("b", 24)
			j := Job{ID: id, App: "primo-c-" + id, State: "ready", Machine: "m", Volume: "v", DomainRotation: DomainRotation{Phase: "apply", ParentHash: hashToken("parent"), Token: "FlyV1 child", SecretsVersion: 12}}
			updates := 0
			loaded := false
			released := 0
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/apps/"+j.App+"/machines/m/lease" {
					if r.Method == "POST" {
						json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"nonce": "lease"}})
					} else {
						released++
						if r.Header.Get("fly-machine-lease-nonce") != "lease" {
							t.Error("release omitted lease")
						}
						w.Write([]byte(`{}`))
					}
					return
				}
				if r.URL.Path == "/apps/"+j.App+"/machines/m/exec" {
					if r.Header.Get("fly-machine-lease-nonce") != "" {
						http.Error(w, "Machine is leased", 409)
						return
					}
					json.NewEncoder(w).Encode(map[string]any{"exit_code": 0, "stdout": map[bool]string{true: hashToken(j.DomainRotation.Token), false: hashToken("old")}[loaded] + "  -\n"})
					return
				}
				if r.Method == "GET" {
					state := "started"
					if stopped {
						state = "stopped"
					}
					json.NewEncoder(w).Encode(machine{ID: "m", Name: "primo-" + id, InstanceID: "version", State: state, Config: map[string]any{"image": "preserve-image", "env": map[string]string{"PRIMO_HOSTED_MODE": "true", "PRIMO_DOMAIN_PROVIDER": "fly"}, "mounts": []map[string]string{{"volume": "v", "path": "/app/pb_data"}}, "services": []string{"preserve-services"}}})
					return
				}
				updates++
				if r.Header.Get("fly-machine-lease-nonce") != "lease" {
					t.Error("update omitted lease")
				}
				var body map[string]any
				json.NewDecoder(r.Body).Decode(&body)
				config := body["config"].(map[string]any)
				if config["image"] != "preserve-image" || body["current_version"] != "version" || body["min_secrets_version"] != float64(12) {
					t.Error("update changed config or omitted version")
				}
				loaded = true
				http.Error(w, "lost response", 503)
			})
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				out := httptest.NewRecorder()
				handler.ServeHTTP(out, r)
				return out.Result(), nil
			})}
			p := &FlyProvisioner{Config: Config{FlyToken: "parent"}, Client: client, FlyEndpoint: "https://machines.example"}
			err := p.RotateDomainToken(context.Background(), &j)
			if stopped {
				if !errors.Is(err, errCredentialWaiting) || updates != 0 || released != 0 {
					t.Fatal("stopped Machine was restarted")
				}
				return
			}
			if err == nil || j.DomainRotation.Phase != "apply" || updates != 1 {
				t.Fatal("did not simulate lost update response")
			}
			if err = p.RotateDomainToken(context.Background(), &j); err != nil || updates != 1 || j.DomainRotation.Phase != "verify" || released != 1 {
				t.Fatal("lost response caused repeat restart")
			}
		})
	}
}
func fmtBool(v bool) string {
	if v {
		return "stopped"
	}
	return "running"
}

func TestCredentialMailOutageDoesNotBlockServerUpdates(t *testing.T) {
	s, _, p, mail, _, j := credentialFixture(t)
	p.expires = s.now().Add(20 * 24 * time.Hour).Unix()
	mail.fail = true
	for i := 0; i < 5; i++ {
		if err := s.MaintainCredentials(context.Background(), "test-owner"); err == nil {
			t.Fatal("mail outage was not reported")
		}
	}
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "" || saved.DomainParentHash != hashToken(s.Config.FlyToken) || credentialsOf(t, s.Store, saved).DomainToken != "FlyV1 app-only-replacement" {
		t.Fatal("mail outage prevented safe credential update")
	}
}
func TestNewParentSupersedesIncompleteDomainUpdate(t *testing.T) {
	s, _, _, _, _, j := credentialFixture(t)
	runCredentials(t, s)
	runCredentials(t, s)
	saved, _ := s.Store.Get(j.ID)
	if saved.DomainRotation.Token == "" {
		t.Fatal("pending token was not issued")
	}
	s.Config.FlyToken = "FlyV1 newer-parent"
	s.Credentials.Config = s.Config
	runCredentials(t, s)
	saved, _ = s.Store.Get(j.ID)
	if saved.DomainRotation.Phase != "issue" || saved.DomainRotation.ParentHash != hashToken(s.Config.FlyToken) || saved.DomainRotation.Token != "" || credentialsOf(t, s.Store, saved).DomainToken != "FlyV1 original-child" {
		t.Fatal("superseded pending update was committed")
	}
}
