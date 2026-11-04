package hosting

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFinalCheckWaitsForBootstrapSecretRemovalBeforeReadyEmail(t *testing.T) {
	for _, tc := range []struct {
		name       string
		http, exit int
		stdout     string
	}{
		{"old process still has bootstrap secrets", 200, 1, ""},
		{"restart holds exec lease", 409, 0, ""},
		{"restart still unavailable", 503, 0, ""},
		{"domain credential not loaded", 200, 0, hashToken("") + "  -\n"},
		{"incorrect domain credential", 200, 0, hashToken("wrong") + "  -\n"},
		{"malformed proof", 200, 0, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			j := Job{ID: "00112233445566778899aabb", App: "primo-c-00112233445566778899aabb", Machine: "machine", Slug: "restart-test", State: "final_check", Email: "owner@example.com", Plan: Plan{Sites: 3, OwnerOnly: true}}
			c := Credentials{Password: "purchaser-password", DomainToken: "app-only-domain-key"}
			p := NewFlyProvisioner(Config{Domain: "primo.page"})
			loaded := false
			publicChecks := 0
			p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				w := httptest.NewRecorder()
				if r.URL.Host == "api.machines.dev" {
					if r.Method != "POST" || !strings.HasSuffix(r.URL.Path, "/machines/machine/exec") {
						t.Fatal("unexpected private check")
					}
					raw, _ := io.ReadAll(r.Body)
					if strings.Contains(string(raw), c.DomainToken) || strings.Contains(string(raw), c.Password) {
						t.Fatal("credential value embedded in exec command")
					}
					var body struct {
						Command []string `json:"command"`
					}
					if json.Unmarshal(raw, &body) != nil || len(body.Command) != 3 || body.Command[0] != "sh" {
						t.Fatal("structured check required")
					}
					if !loaded {
						w.WriteHeader(tc.http)
						json.NewEncoder(w).Encode(map[string]any{"exit_code": tc.exit, "stdout": tc.stdout})
					} else {
						json.NewEncoder(w).Encode(map[string]any{"exit_code": 0, "stdout": hashToken(c.DomainToken) + "  -\n"})
					}
				} else {
					publicChecks++
					switch {
					case strings.HasSuffix(r.URL.Path, "/api/health"):
						w.Write([]byte(`{"code":200}`))
					case strings.HasSuffix(r.URL.Path, "/api/primo/info"):
						w.Write([]byte(`{"hosted_mode":true,"site_cap":3,"editor_cap":0,"owner_only":true,"domain_provider":"fly"}`))
					case strings.Contains(r.URL.Path, "/_superusers/"):
						w.WriteHeader(400)
					default:
						w.Write([]byte(`{"record":{"email":"owner@example.com","serverRole":"developer"}}`))
					}
				}
				return w.Result(), nil
			})}
			if err := p.Step(context.Background(), &j, &c); !errors.Is(err, errNotReady) {
				t.Fatalf("old process should remain pending: %v", err)
			}
			if j.State != "final_check" || publicChecks != 0 || c.Password == "" {
				t.Fatal("old process advanced readiness or discarded purchaser password")
			}
			loaded = true
			if err := p.Step(context.Background(), &j, &c); err != nil {
				t.Fatal(err)
			}
			if j.State != "ready_email" || publicChecks != 5 {
				t.Fatal("restarted process must still pass public TLS/health and purchaser authentication checks")
			}
		})
	}
}
