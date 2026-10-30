package hosting

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func smtpProvisioner(t *testing.T, handler func(*http.Request, map[string]any) (int, any)) *FlyProvisioner {
	t.Helper()
	p := NewFlyProvisioner(Config{SMTPManagementToken: "management-secret", SMTPDomainID: "domain-id", ResendToken: "control-send-only", FromEmail: "Primo <hello@email.primo.build>", Domain: "primo.page"})
	p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := map[string]any{}
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&body)
		}
		if r.URL.Host == "api.resend.com" {
			if r.Header.Get("Authorization") != "Bearer management-secret" {
				t.Fatal("wrong management credential")
			}
		} else {
			raw, _ := json.Marshal(body)
			if strings.Contains(string(raw), "management-secret") || strings.Contains(string(raw), "control-send-only") || strings.Contains(r.Header.Get("Authorization"), "management-secret") {
				t.Fatal("parent credential leaked to customer")
			}
		}
		status, value := handler(r, body)
		w := httptest.NewRecorder()
		w.WriteHeader(status)
		if value != nil {
			json.NewEncoder(w).Encode(value)
		}
		return w.Result(), nil
	})}
	return p
}
func TestSMTPKeyLostResponseReconcilesOnlyJobOwnedOrphan(t *testing.T) {
	j := Job{ID: "00112233445566778899aabb", State: "smtp_key"}
	c := Credentials{}
	creates, deletes := 0, 0
	orphan := false
	p := smtpProvisioner(t, func(r *http.Request, b map[string]any) (int, any) {
		switch r.Method {
		case "GET":
			keys := []map[string]string{{"id": "unrelated", "name": "another customer"}}
			if orphan {
				keys = append(keys, map[string]string{"id": "lost-key", "name": "primo-hosted-" + j.ID})
			}
			return 200, map[string]any{"data": keys, "has_more": false}
		case "DELETE":
			if r.URL.Path != "/api-keys/lost-key" {
				t.Fatal("deleted unrelated key")
			}
			deletes++
			orphan = false
			return 204, nil
		case "POST":
			if b["permission"] != "sending_access" || b["domain_id"] != "domain-id" || b["name"] != "primo-hosted-"+j.ID {
				t.Fatal("customer key not restricted")
			}
			creates++
			if creates == 1 {
				orphan = true
				return 500, map[string]string{"token": "must-not-log"}
			}
			return 200, map[string]string{"id": "saved-key", "token": "re_customer-only"}
		}
		t.Fatal("unexpected request")
		return 500, nil
	})
	if err := p.Step(context.Background(), &j, &c); err == nil || strings.Contains(err.Error(), "must-not-log") {
		t.Fatal("lost create was not safely failed")
	}
	if j.State != "smtp_key" || c.SMTPPassword != "" {
		t.Fatal("failed key advanced checkpoint")
	}
	if err := p.Step(context.Background(), &j, &c); err != nil {
		t.Fatal(err)
	}
	if j.State != "smtp_settings" || j.SMTPKeyID != "saved-key" || c.SMTPPassword != "re_customer-only" || deletes != 1 || creates != 2 {
		t.Fatal("orphan reconciliation failed")
	}
	// Replaying a successfully saved checkpoint must not mint another credential.
	j.State = "smtp_key"
	if err := p.Step(context.Background(), &j, &c); err != nil || creates != 2 {
		t.Fatal("checkpoint replay duplicated key")
	}
}
func TestSMTPSettingsRetriesReuseKeyAndVerifyBeforeCleanup(t *testing.T) {
	j := Job{ID: "00112233445566778899aabb", Slug: "smtp-customer", State: "smtp_settings", SMTPKeyID: "customer-key"}
	c := Credentials{AdminPassword: "admin-secret", SMTPPassword: "re_customer-only"}
	patches := 0
	enabled := false
	p := smtpProvisioner(t, func(r *http.Request, b map[string]any) (int, any) {
		if r.URL.Host != "smtp-customer.primo.page" {
			t.Fatal("unexpected customer host")
		}
		switch r.URL.Path {
		case "/api/collections/_superusers/auth-with-password":
			if b["password"] != "admin-secret" {
				t.Fatal("wrong setup identity")
			}
			return 200, map[string]string{"token": "customer-admin-session"}
		case "/api/settings":
			if r.Header.Get("Authorization") != "Bearer customer-admin-session" {
				t.Fatal("wrong settings auth")
			}
			if r.Method == "PATCH" {
				patches++
				smtp := b["smtp"].(map[string]any)
				meta := b["meta"].(map[string]any)
				if smtp["password"] != "re_customer-only" || smtp["port"] != float64(465) || smtp["tls"] != true || meta["senderAddress"] != "hello@email.primo.build" || meta["appURL"] != "https://smtp-customer.primo.page" || meta["appName"] != "Existing name" {
					t.Fatal("wrong SMTP settings or lost metadata")
				}
				enabled = true
				if patches == 1 {
					return 503, nil
				}
				return 200, nil
			}
			return 200, map[string]any{"meta": map[string]any{"appName": "Existing name", "senderAddress": "hello@email.primo.build", "appURL": "https://smtp-customer.primo.page"}, "smtp": map[string]any{"enabled": enabled, "tls": true, "host": "smtp.resend.com", "port": 465, "username": "resend", "authMethod": "PLAIN"}}
		}
		t.Fatal("unexpected request")
		return 500, nil
	})
	if err := p.Step(context.Background(), &j, &c); err == nil || j.State != "smtp_settings" {
		t.Fatal("lost settings response advanced job")
	}
	if err := p.Step(context.Background(), &j, &c); err != nil {
		t.Fatal(err)
	}
	if patches != 2 || j.State != "cleanup" {
		t.Fatal("SMTP setup did not verify and advance")
	}
}
func TestSMTPSettingsRejectFalseSuccess(t *testing.T) {
	j := Job{Slug: "smtp-customer", State: "smtp_settings", SMTPKeyID: "key"}
	c := Credentials{AdminPassword: "admin", SMTPPassword: "re_customer"}
	p := smtpProvisioner(t, func(r *http.Request, b map[string]any) (int, any) {
		if strings.HasSuffix(r.URL.Path, "auth-with-password") {
			return 200, map[string]string{"token": "session"}
		}
		if r.Method == "PATCH" {
			return 200, nil
		}
		return 200, map[string]any{"meta": map[string]any{}, "smtp": map[string]any{"enabled": false}}
	})
	if err := p.Step(context.Background(), &j, &c); err == nil || j.State != "smtp_settings" {
		t.Fatal("disabled SMTP marked configured")
	}
}
func TestSMTPRevokeIsRetryableAndIdempotent(t *testing.T) {
	calls := 0
	p := smtpProvisioner(t, func(r *http.Request, _ map[string]any) (int, any) {
		if r.Method != "DELETE" || r.URL.Path != "/api-keys/customer-key" {
			t.Fatal("wrong key revoked")
		}
		calls++
		if calls == 1 {
			return 503, nil
		}
		return 404, nil
	})
	j := Job{SMTPKeyID: "customer-key"}
	if err := p.RevokeSMTPKey(context.Background(), &j); !errors.Is(err, apiStatus(503)) {
		t.Fatal("revocation error swallowed")
	}
	if err := p.RevokeSMTPKey(context.Background(), &j); err != nil {
		t.Fatal(err)
	}
}
func TestSMTPSecretsRemainEncryptedAtRest(t *testing.T) {
	store, err := OpenStore(t.TempDir()+"/state.sqlite", make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	raw, _ := json.Marshal(Credentials{SMTPPassword: "re_customer-only"})
	encrypted, err := store.seal("job:credentials", string(raw))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(encrypted, "re_customer-only") {
		t.Fatal("plaintext SMTP credential")
	}
	plain, err := store.open("job:credentials", encrypted)
	if err != nil || plain != string(raw) {
		t.Fatal("SMTP checkpoint not recoverable")
	}
}

func TestRetirementRequiresSuccessfulSMTPRevocation(t *testing.T) {
	s, _, _ := fixture(t)
	j := enqueue(t, s)
	j.State = "ready"
	j.SMTPKeyID = "customer-key"
	if err := s.Store.Save(j); err != nil {
		t.Fatal(err)
	}
	attempts := 0
	p := smtpProvisioner(t, func(r *http.Request, _ map[string]any) (int, any) {
		attempts++
		if r.Method != "DELETE" || r.URL.Path != "/api-keys/customer-key" {
			t.Fatal("wrong retirement credential")
		}
		if attempts == 1 {
			return 503, nil
		}
		return 204, nil
	})
	s.Provisioner = p
	retire := func() int {
		r := httptest.NewRequest("POST", "/ops/jobs/"+j.ID+"/retire", nil)
		r.Header.Set("Authorization", "Bearer "+s.Config.OpsToken)
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, r)
		return w.Code
	}
	if retire() != 503 {
		t.Fatal("failed revocation accepted retirement")
	}
	got, _ := s.Store.Get(j.ID)
	if got.Retired {
		t.Fatal("job retired before credential revoked")
	}
	if retire() != 202 {
		t.Fatal("successful revocation did not retire")
	}
	got, _ = s.Store.Get(j.ID)
	if !got.Retired {
		t.Fatal("retirement not saved")
	}
}
