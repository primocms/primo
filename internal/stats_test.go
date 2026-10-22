package internal

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestUsageStatsEnablement(t *testing.T) {
	cases := []struct {
		name, hosted, override, dev string
		enabled                     bool
	}{
		{"self-hosted default on", "", "", "", true},
		{"hosted default on", "true", "", "", true},
		{"self-hosted opt-out", "", "false", "", false},
		{"hosted opt-out", "true", "false", "", false},
		{"explicit enable", "", "true", "", true},
		{"development disabled", "", "", "1", false},
		{"development overrides explicit enable", "true", "true", "1", false},
	}
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterInfoEndpoint(app); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}); err != nil {
		t.Fatal(err)
	}
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PRIMO_HOSTED_MODE", tc.hosted)
			t.Setenv("PRIMO_ENABLE_USAGE_STATS", tc.override)
			t.Setenv("PRIMO_DEV_MODE", tc.dev)
			if got := isUsageStateEnabled(); got != tc.enabled {
				t.Fatalf("enabled=%v, want %v", got, tc.enabled)
			}
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, httptest.NewRequest("GET", "/api/primo/info", nil))
			if response.Code != http.StatusOK {
				t.Fatalf("info status %d: %s", response.Code, response.Body.String())
			}
			var info struct {
				TelemetryEnabled bool `json:"telemetry_enabled"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &info); err != nil {
				t.Fatal(err)
			}
			if info.TelemetryEnabled != tc.enabled {
				t.Fatalf("API telemetry_enabled=%v, want %v", info.TelemetryEnabled, tc.enabled)
			}
		})
	}
}

type statsTestTransport func(*http.Request) (*http.Response, error)

func (f statsTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestUsageStatsHeartbeatAndOptOut(t *testing.T) {
	t.Setenv("PRIMO_HOSTED_MODE", "")
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "")
	t.Setenv("PRIMO_DEV_MODE", "")
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	old := usageStatsClient
	t.Cleanup(func() { usageStatsClient = old })
	calls := 0
	usageStatsClient = &http.Client{Transport: statsTestTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != "POST" || r.URL.String() != usageStatsHost+"/i/v0/e/" {
			t.Fatal("unexpected heartbeat request")
		}
		var captured map[string]any
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatal(err)
		}
		if captured["event"] != "instance_heartbeat" || captured["distinct_id"] == "" {
			t.Fatal("missing heartbeat event or instance identity")
		}
		properties := captured["properties"].(map[string]any)
		if len(properties) != 3 {
			t.Fatal("heartbeat must only include record counts")
		}
		for _, key := range []string{"sites_count", "pages_count", "users_count"} {
			if _, ok := properties[key]; !ok {
				t.Fatalf("missing %s", key)
			}
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("{}")), Header: make(http.Header)}, nil
	})}
	if err := sendUsageStats(app); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatal("default-on self-hosted instance did not send heartbeat")
	}
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "false")
	if err := sendUsageStats(app); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatal("opt-out still sent a heartbeat")
	}
}

func TestUsageStatsStartupDoesNotWaitForDelivery(t *testing.T) {
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "")
	t.Setenv("PRIMO_DEV_MODE", "")
	app := newImportTestApp(t)
	t.Cleanup(func() { app.ResetBootstrapState() })
	old := usageStatsClient
	t.Cleanup(func() { usageStatsClient = old })
	attempted := make(chan struct{})
	release := make(chan struct{})
	finished := make(chan struct{})
	t.Cleanup(func() {
		close(release)
		select {
		case <-finished:
		case <-time.After(5 * time.Second):
			t.Error("heartbeat did not finish after releasing the transport")
		}
	})
	usageStatsClient = &http.Client{Transport: statsTestTransport(func(r *http.Request) (*http.Response, error) {
		close(attempted)
		<-release
		defer close(finished)
		return nil, errors.New("outbound analytics blocked")
	})}
	if err := RegisterUsageStats(app); err != nil {
		t.Fatal(err)
	}
	if err := RegisterInfoEndpoint(app); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	served := make(chan error, 1)
	go func() { served <- app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}) }()
	select {
	case err := <-served:
		if err != nil {
			t.Fatalf("analytics prevented startup: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("startup waited for stalled analytics delivery")
	}
	select {
	case <-attempted:
	case <-time.After(2 * time.Second):
		t.Fatal("startup heartbeat was not attempted")
	}
	// A request must be served while the analytics request is still stalled.
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("GET", "/api/primo/info", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("info unavailable during analytics delivery: %s", response.Body.String())
	}
}
