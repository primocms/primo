package hosting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestFlyPipelineReconcilesLostResponsesAndProtectsBootstrap(t *testing.T) {
	j := Job{ID: "00112233445566778899aabb", App: "primo-c-00112233445566778899aabb", Email: "customer@example.com", Slug: "example-server", Plan: Plan{Name: "Maker", Sites: 3, OwnerOnly: true}, State: "app"}
	c := Credentials{Password: " leading # \"quoted\" \\ $pass=word ", AdminPassword: "operator-secret"}
	app, volume, machineCreated := false, false, false
	var machineConfig map[string]any
	secrets := map[string]any{}
	dns := map[string]dnsRecord{}
	failed := map[string]bool{}
	creates := map[string]int{}
	tokenCalls, checks, published, secretVersion := 0, 0, false, 0
	p := NewFlyProvisioner(Config{FlyOrg: "primo-hosted", Region: "iad", Domain: "primo.page", Image: "registry.fly.io/primo-hosted-smoke@sha256:fixed", FlyToken: "org-secret", CloudflareToken: "zone-secret", CloudflareZone: "zone-id", BillingURL: "https://polar.sh/primo/portal"})
	p.Run = func(_ context.Context, stdin string, args ...string) ([]byte, error) {
		if stdin != "" && strings.Join(args[:2], " ") != "tokens attenuate" {
			t.Fatal("customer secrets passed through CLI parser")
		}
		switch strings.Join(args[:2], " ") {
		case "tokens debug":
			return []byte(fmt.Sprintf(`[{"caveats":[{"type":"ValidityWindow","body":{"not_after":%d}}]}]`, time.Now().Add(30*24*time.Hour).Unix())), nil
		case "tokens attenuate":
			tokenCalls++
			if !strings.Contains(stdin, `"12345":"rwcdC"`) || !strings.Contains(stdin, `"ValidityWindow"`) {
				t.Fatal("token not scoped to customer app")
			}
			return []byte("FlyV1 app-only-secret\n"), nil
		case "ips list":
			return []byte(`[{"Type":"shared_v4"},{"Type":"v6"}]`), nil
		default:
			t.Fatalf("unexpected or interactive Fly command %v", args)
			return nil, nil
		}
	}
	cert := func(host string, active bool) map[string]any {
		items := []map[string]any{}
		if active {
			items = append(items, map[string]any{"status": "active", "expires_at": time.Now().Add(90 * 24 * time.Hour).Format(time.RFC3339)})
		}
		return map[string]any{"hostname": host, "configured": active, "status": "Ready", "certificates": items, "dns_requirements": map[string]any{"cname": "customer-target.fly.dev", "acme_challenge": map[string]string{"name": "_acme-challenge.example-server.primo.page", "target": "example-server.primo.page.challenge.flydns.net"}, "ownership": map[string]string{"name": "_fly-ownership.example-server.primo.page", "app_value": "app-only-ownership"}}}
	}
	p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		w := httptest.NewRecorder()
		path := r.URL.Path
		body := map[string]any{}
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&body)
		}
		write := func(v any) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(v) }
		lost := func(phase string) bool {
			if !failed[phase] {
				failed[phase] = true
				w.WriteHeader(500)
				w.Write([]byte("sensitive upstream data"))
				return true
			}
			return false
		}
		if r.URL.Host == "api.cloudflare.com" {
			if r.Header.Get("Authorization") != "Bearer zone-secret" {
				t.Fatal("wrong DNS credential")
			}
			if r.Method == "GET" && r.URL.Query().Get("name") == "" {
				write(map[string]any{"success": true, "result_info": map[string]int{"total_count": 40}})
			} else if r.Method == "GET" {
				records := []dnsRecord{}
				if record, ok := dns[r.URL.Query().Get("name")]; ok {
					records = append(records, record)
				}
				write(map[string]any{"success": true, "result": records})
			} else if r.Method == "POST" {
				raw, _ := json.Marshal(body)
				var record dnsRecord
				json.Unmarshal(raw, &record)
				if record.Proxied {
					t.Fatal("wildcard DNS must be DNS-only")
				}
				dns[record.Name] = record
				creates["dns"]++
				if !lost("dns") {
					write(map[string]any{"success": true})
				}
			} else {
				t.Fatal("DNS records must not be overwritten")
			}
			return w.Result(), nil
		}
		if strings.HasSuffix(r.URL.Host, "primo.page") {
			if !published {
				t.Fatal("public verification attempted before private bootstrap and TLS")
			}
			switch path {
			case "/api/health":
				write(map[string]int{"code": 200})
			case "/api/primo/info":
				write(map[string]any{"hosted_mode": true, "site_cap": 3, "owner_only": true, "domain_provider": "fly"})
			case "/api/collections/users/auth-with-password":
				if body["password"] != c.Password {
					t.Fatal("password punctuation changed")
				}
				write(map[string]any{"record": map[string]string{"email": j.Email, "serverRole": "developer"}})
			case "/api/collections/_superusers/auth-with-password":
				w.WriteHeader(400)
			default:
				t.Fatalf("unexpected customer request %s", path)
			}
			return w.Result(), nil
		}
		if r.Header.Get("Authorization") != "Bearer org-secret" && !(path == "/v1/apps/"+j.App && r.Method == "GET" && r.Header.Get("Authorization") == "Bearer FlyV1 app-only-secret") {
			t.Fatal("wrong Fly provisioning credential")
		}
		base := "/v1/apps/" + j.App
		switch {
		case path == "/v1/apps" && r.Method == "POST":
			if body["network"] != j.App || body["org_slug"] != "primo-hosted" {
				t.Fatal("customer network not isolated")
			}
			app = true
			creates["app"]++
			if !lost("app") {
				write(map[string]string{"id": "app-id"})
			}
		case path == base:
			if !app {
				w.WriteHeader(404)
			} else {
				write(map[string]any{"name": j.App, "internal_numeric_id": 12345, "organization": map[string]string{"slug": "primo-hosted"}})
			}
		case path == base+"/volumes":
			if r.Method == "GET" {
				out := []map[string]any{}
				if volume {
					out = append(out, map[string]any{"id": "volume-id", "name": "pb_data", "region": "iad", "encrypted": true, "state": "created"})
				}
				write(out)
			} else {
				if body["encrypted"] != true || body["auto_backup_enabled"] != true || body["snapshot_retention"] != float64(7) {
					t.Fatal("storage backup configuration missing")
				}
				volume = true
				creates["volume"]++
				if !lost("volume") {
					write(map[string]string{"id": "volume-id"})
				}
			}
		case path == base+"/secrets":
			values := body["values"].(map[string]any)
			secretVersion++
			for key, value := range values {
				if value == nil {
					delete(secrets, key)
				} else {
					secrets[key] = value
				}
			}
			if value, ok := values["PRIMO_USER_PASSWORD"]; ok && value != nil && value != c.Password {
				t.Fatal("JSON secrets failed to preserve password")
			}
			if value, ok := values["PRIMO_FLY_TOKEN"]; ok && value != "FlyV1 app-only-secret" {
				t.Fatal("org token leaked into customer app")
			}
			write(map[string]int{"version": secretVersion})
		case path == base+"/machines":
			if r.Method == "GET" {
				out := []map[string]any{}
				if machineCreated {
					out = append(out, map[string]any{"id": "machine-id", "name": "primo-" + j.ID, "config": machineConfig})
				}
				write(out)
			} else {
				if !volume || secrets["PRIMO_USER_PASSWORD"] != c.Password || body["min_secrets_version"] != float64(secretVersion) {
					t.Fatal("server started without persistent storage and credentials")
				}
				machineConfig = body["config"].(map[string]any)
				if len(machineConfig["services"].([]any)) != 0 {
					t.Fatal("server exposed before bootstrap")
				}
				env := machineConfig["env"].(map[string]any)
				if env["PRIMO_MANAGED_BOOTSTRAP"] != "true" || env["PRIMO_OWNER_ONLY"] != "true" {
					t.Fatal("bootstrap guard disabled")
				}
				machineCreated = true
				creates["machine"]++
				if !lost("machine") {
					write(map[string]string{"id": "machine-id"})
				}
			}
		case path == base+"/machines/machine-id/exec":
			if body["cmd"] != "wget -q -O - http://127.0.0.1:8080/api/primo/info" {
				t.Fatal("wrong Fly exec schema")
			}
			write(map[string]any{"exit_code": 0, "stdout": `{"hosted_mode":true,"managed_bootstrap":true,"site_cap":3,"owner_only":true,"domain_provider":"fly"}`})
		case path == base+"/machines/machine-id":
			if r.Method == "GET" {
				write(map[string]any{"name": "primo-" + j.ID, "config": machineConfig})
			} else {
				if checks < 3 || len(dns) != 4 {
					t.Fatal("server exposed before certificates are ready")
				}
				machineConfig = body["config"].(map[string]any)
				published = true
				if secretVersion > 1 && body["min_secrets_version"] != float64(secretVersion) {
					t.Fatal("bootstrap secrets not removed from running server")
				}
				write(map[string]any{})
			}
		case strings.HasSuffix(path, "/check"):
			checks++
			name := strings.TrimSuffix(strings.TrimPrefix(path, base+"/certificates/"), "/check")
			write(cert(name, checks > 1))
		case strings.Contains(path, "/certificates/"):
			write(cert(strings.TrimPrefix(path, base+"/certificates/"), false))
		default:
			t.Fatalf("unexpected Fly request %s %s", r.Method, path)
		}
		return w.Result(), nil
	})}
	for attempts := 0; j.State != "ready_email" && attempts < 40; attempts++ {
		phase := j.State
		err := p.Step(context.Background(), &j, &c)
		if err != nil {
			if j.State != phase {
				t.Fatal("error advanced checkpoint")
			}
			if !errors.Is(err, apiStatus(500)) && !errors.Is(err, errNotReady) {
				t.Fatalf("phase %s: %v", phase, err)
			}
		}
	}
	if j.State != "ready_email" {
		t.Fatalf("provisioning stuck at %s", j.State)
	}
	if creates["app"] != 1 || creates["volume"] != 1 || creates["machine"] != 1 || creates["dns"] != 4 || tokenCalls != 1 {
		t.Fatalf("retry duplicated resources: %v tokens=%d", creates, tokenCalls)
	}
	if len(secrets) != 1 || secrets["PRIMO_FLY_TOKEN"] != "FlyV1 app-only-secret" {
		t.Fatal("bootstrap secrets remained on app")
	}
}

func TestDNSConflictAndProviderErrorsCannotLeakCredentials(t *testing.T) {
	p := NewFlyProvisioner(Config{CloudflareZone: "zone", CloudflareToken: "top-secret"})
	p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		w := httptest.NewRecorder()
		json.NewEncoder(w).Encode(map[string]any{"success": true, "result": []dnsRecord{{Type: "CNAME", Name: "used.primo.page", Content: "existing-customer.railway.app"}}})
		return w.Result(), nil
	})}
	if err := p.CheckSlug(context.Background(), "used"); !errors.Is(err, ErrSlug) {
		t.Fatal("existing Railway hostname can be claimed")
	}
	if err := p.ensureDNS(context.Background(), dnsRecord{Type: "CNAME", Name: "used.primo.page", Content: "fly-target"}); err == nil {
		t.Fatal("existing tenant DNS can be overwritten")
	}
	p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		w := httptest.NewRecorder()
		w.WriteHeader(401)
		io.WriteString(w, "top-secret")
		return w.Result(), nil
	})}
	err := p.ensureDNS(context.Background(), dnsRecord{Name: "new.primo.page"})
	if err == nil || strings.Contains(err.Error(), "top-secret") {
		t.Fatal("raw provider response leaked")
	}
}

func TestDNSCapacityStopsBeforeAllocatingResources(t *testing.T) {
	p := NewFlyProvisioner(Config{CloudflareZone: "zone", DNSLimit: 200})
	p.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "api.cloudflare.com" {
			t.Fatal("allocated Fly resources despite full DNS zone")
		}
		w := httptest.NewRecorder()
		io.WriteString(w, `{"success":true,"result_info":{"total_count":197}}`)
		return w.Result(), nil
	})}
	j := Job{State: "app", App: "test-app"}
	if p.Step(context.Background(), &j, &Credentials{}) == nil || j.State != "app" {
		t.Fatal("full zone did not stop provisioning")
	}
}
