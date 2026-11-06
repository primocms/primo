package internal

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func flyFixture(host string) flyCertificate {
	var c flyCertificate
	raw := fmt.Sprintf(`{"hostname":%q,"status":"Awaiting configuration","dns_requirements":{"a":["66.241.124.148"],"aaaa":["2a09:8280:1::123"],"cname":"target.test.fly.dev","acme_challenge":{"name":"_acme-challenge.%s","target":"delegation.flydns.net."},"ownership":{"name":"_fly-ownership.%s","app_value":"app-test"}}}`, host, host, host)
	if err := json.Unmarshal([]byte(raw), &c); err != nil {
		panic(err)
	}
	return c
}
func activeFlyFixture(host string) flyCertificate {
	c := flyFixture(host)
	c.Configured = true
	c.Status = "Ready"
	c.Validation.DNS = true
	c.Validation.Ownership = true
	c.Records.CNAME = []string{"target.test.fly.dev."}
	c.Records.A = c.Requirements.A
	c.Records.AAAA = c.Requirements.AAAA
	c.Records.Resolved = append(append([]string{}, c.Requirements.A...), c.Requirements.AAAA...)
	if err := json.Unmarshal([]byte(`[{"status":"active","expires_at":"2030-01-01T00:00:00Z"}]`), &c.Certificates); err != nil {
		panic(err)
	}
	return c
}

func TestFlyDomainRecords(t *testing.T) {
	now := time.Date(2026, 10, 4, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		host  string
		types []string
	}{
		{"www.example.com", []string{"CNAME", "CNAME", "TXT"}},
		{"example.com", []string{"A", "AAAA", "CNAME", "TXT"}},
		{"example.co.uk", []string{"A", "AAAA", "CNAME", "TXT"}},
		{"www.example.co.uk", []string{"CNAME", "CNAME", "TXT"}},
	} {
		t.Run(tc.host, func(t *testing.T) {
			c := flyFixture(tc.host)
			result := toFlyDomainResult(c, now)
			if result.Status != DomainStatusPending || result.ProviderID != tc.host || len(result.Records) != len(tc.types) {
				t.Fatalf("unexpected pending result: %+v", result)
			}
			for i, kind := range tc.types {
				if result.Records[i].Type != kind || result.Records[i].Status != "pending" {
					t.Fatalf("wrong DNS record: %+v", result.Records[i])
				}
			}
			if result.Records[len(result.Records)-2].Value != "delegation.flydns.net" {
				t.Fatal("ACME target has trailing dot")
			}
			c = activeFlyFixture(tc.host)
			result = toFlyDomainResult(c, now)
			if result.Status != DomainStatusLive {
				t.Fatalf("active domain = %+v", result)
			}
			for _, r := range result.Records {
				if r.Status != "valid" {
					t.Errorf("propagated record should be valid: %+v", r)
				}
			}
		})
	}
}

func TestFlyDomainNeverClaimsUnissuedOrExpiredCertificateLive(t *testing.T) {
	now := time.Date(2026, 10, 4, 0, 0, 0, 0, time.UTC)
	for _, mode := range []string{"missing-cert", "expired-cert", "wrong-routing", "unknown-status", "failed", "dns-only"} {
		t.Run(mode, func(t *testing.T) {
			c := activeFlyFixture("www.example.com")
			want := DomainStatusVerifying
			switch mode {
			case "missing-cert":
				c.Certificates = nil
			case "expired-cert":
				c.Certificates[0].ExpiresAt = now.Add(-time.Hour)
			case "wrong-routing":
				c.Records.CNAME = []string{"another.fly.dev"}
				c.Records.A = nil
				c.Records.AAAA = nil
				c.Records.Resolved = nil
			case "unknown-status":
				c = flyFixture("www.example.com")
				c.Status = "Ready"
				want = DomainStatusPending
			case "failed":
				c = flyFixture("www.example.com")
				c.Status = "failed"
				want = DomainStatusError
			case "dns-only":
				c = flyFixture("www.example.com")
				c.Validation.DNS = true
			}
			result := toFlyDomainResult(c, now)
			if result.Status != want {
				t.Fatalf("%s: got %+v, want %s", mode, result, want)
			}
		})
	}
}

func TestFlyWildcardCoverage(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "workspace.primo.page")
	for host, want := range map[string]bool{
		"site.workspace.primo.page":     true,
		"Site.Workspace.Primo.Page":     true,
		"workspace.primo.page":          false,
		"a.b.workspace.primo.page":      false,
		"workspace.primo.page.evil.com": false,
	} {
		if got := coveredByFlyWildcard(host); got != want {
			t.Errorf("%s: %v, want %v", host, got, want)
		}
	}
	// Covered sites must not require per-site API calls or credentials.
	p := flyProvider{}
	if result, err := p.AttachDomain("site.workspace.primo.page"); err != nil || result.Status != DomainStatusLive {
		t.Fatalf("wildcard attach: %+v, %v", result, err)
	}
	if result, err := p.DomainStatus("old-id", "site.workspace.primo.page"); err != nil || result.Status != DomainStatusLive {
		t.Fatalf("wildcard poll: %+v, %v", result, err)
	}
	t.Setenv("PRIMO_BASE_DOMAIN", "")
	if coveredByFlyWildcard("site.workspace.primo.page") {
		t.Fatal("empty base must not short-circuit")
	}
}

func TestFlyAttachAndPollRequests(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "")
	for _, mode := range []string{"new", "existing", "concurrent", "unauthorized", "mismatched-host"} {
		t.Run(mode, func(t *testing.T) {
			calls := []string{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if got := r.Header.Get("Authorization"); got != "Bearer private-test-token" {
					t.Errorf("wrong authorization: %q", got)
				}
				if r.Header.Get("Content-Type") != "application/json" {
					t.Error("missing JSON content type")
				}
				calls = append(calls, r.Method+" "+r.URL.Path)
				switch r.Method + " " + r.URL.Path {
				case "GET /apps/test-app/certificates/www.example.com":
					if mode == "unauthorized" {
						w.WriteHeader(401)
						fmt.Fprint(w, "private-test-token")
						return
					}
					if mode != "existing" {
						w.WriteHeader(404)
						return
					}
					json.NewEncoder(w).Encode(activeFlyFixture("www.example.com"))
				case "POST /apps/test-app/certificates/acme":
					var body map[string]string
					if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["hostname"] != "www.example.com" {
						t.Error("wrong attach payload")
					}
					if mode == "concurrent" {
						w.WriteHeader(409)
						return
					}
					c := flyFixture("www.example.com")
					if mode == "mismatched-host" {
						c.Hostname = "other.com"
					}
					w.WriteHeader(201)
					json.NewEncoder(w).Encode(c)
				case "POST /apps/test-app/certificates/www.example.com/check":
					json.NewEncoder(w).Encode(activeFlyFixture("www.example.com"))
				default:
					t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
					w.WriteHeader(500)
				}
			}))
			defer server.Close()
			p := flyProvider{token: "private-test-token", app: "test-app", endpoint: server.URL, client: server.Client()}
			result, err := p.AttachDomain("www.example.com")
			if mode == "unauthorized" || mode == "mismatched-host" {
				if err == nil {
					t.Fatal("expected error")
				}
				if strings.Contains(err.Error(), "private-test-token") {
					t.Fatal("error leaked credentials")
				}
				if mode == "unauthorized" && len(calls) != 1 {
					t.Fatal("must not retry authentication failures")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			want := DomainStatusLive
			if mode == "new" {
				want = DomainStatusPending
			}
			if result.Status != want {
				t.Fatalf("attach: %+v", result)
			}
			if result, err = p.DomainStatus("railway-old-id", "www.example.com"); err != nil || result.Status != DomainStatusLive {
				t.Fatalf("poll: %+v %v", result, err)
			}
			if mode == "existing" && len(calls) != 3 {
				t.Fatalf("existing attachment should be adopted; requests: %v", calls)
			}
		})
	}
}

func TestFlyAPIFailures(t *testing.T) {
	for _, mode := range []string{"missing", "redirect", "invalid-json", "wrong-host"} {
		t.Run(mode, func(t *testing.T) {
			redirected := false
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { redirected = true }))
			defer target.Close()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch mode {
				case "missing":
					w.WriteHeader(404)
				case "redirect":
					http.Redirect(w, r, target.URL, 307)
				case "invalid-json":
					fmt.Fprint(w, "invalid private-test-token")
				case "wrong-host":
					json.NewEncoder(w).Encode(activeFlyFixture("other.com"))
				}
			}))
			defer server.Close()
			p := flyProvider{token: "private-test-token", app: "test-app", endpoint: server.URL, client: server.Client()}
			_, err := p.DomainStatus("ignored", "www.example.com")
			if err == nil {
				t.Fatal("expected error")
			}
			if redirected || strings.Contains(err.Error(), "private-test-token") {
				t.Fatal("must not forward credentials or leak raw errors")
			}
		})
	}
}

func TestFlyProviderConfiguration(t *testing.T) {
	t.Setenv("PRIMO_DOMAIN_PROVIDER", " FLY ")
	t.Setenv("PRIMO_FLY_TOKEN", "")
	t.Setenv("FLY_APP_NAME", "")
	t.Setenv("PRIMO_BASE_DOMAIN", "")
	p := getDomainProvider()
	if p.Name() != "fly" {
		t.Fatal("Fly provider not selected")
	}
	_, err := p.AttachDomain("example.com")
	if err == nil || !strings.Contains(err.Error(), "PRIMO_FLY_TOKEN") || !strings.Contains(err.Error(), "FLY_APP_NAME") {
		t.Fatalf("missing credentials: %v", err)
	}
}
