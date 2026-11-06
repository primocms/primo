package internal

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAgentLaunchInfoCapabilitiesAndDomainReadiness(t *testing.T) {
	for _, name := range []string{"PRIMO_DOMAIN_PROVIDER", "PRIMO_FLY_TOKEN", "FLY_APP_NAME", "PRIMO_RAILWAY_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID"} {
		t.Setenv(name, "")
	}
	app := newPushTestApp(t)
	if err := RegisterInfoEndpoint(app); err != nil {
		t.Fatal(err)
	}
	handler, _ := pushTestHTTP(t, app)
	read := func() map[string]any {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", "http://cms.example.com/api/primo/info", nil))
		if response.Code != 200 {
			t.Fatal(response.Body.String())
		}
		if strings.Contains(response.Body.String(), "private-domain-token") {
			t.Fatal("credential leaked")
		}
		var info map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &info); err != nil {
			t.Fatal(err)
		}
		capabilities := info["capabilities"].([]any)
		found := false
		for _, value := range capabilities {
			if value == "agent_launch_v1" {
				found = true
			}
		}
		if !found {
			t.Fatal("missing launch capability")
		}
		return info
	}
	if read()["domain_provider_ready"] != false {
		t.Fatal("manual provider claimed readiness")
	}
	t.Setenv("PRIMO_DOMAIN_PROVIDER", "fly")
	if read()["domain_provider_ready"] != false {
		t.Fatal("unconfigured Fly provider claimed readiness")
	}
	t.Setenv("PRIMO_FLY_TOKEN", "private-domain-token")
	t.Setenv("FLY_APP_NAME", "test-app")
	if read()["domain_provider_ready"] != true {
		t.Fatal("configured Fly provider not ready")
	}
	t.Setenv("PRIMO_DOMAIN_PROVIDER", "railway")
	if read()["domain_provider_ready"] != false {
		t.Fatal("unconfigured Railway provider claimed readiness")
	}
	for _, name := range []string{"PRIMO_RAILWAY_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID"} {
		t.Setenv(name, "private-domain-token")
	}
	if read()["domain_provider_ready"] != true {
		t.Fatal("configured Railway provider not ready")
	}
}
