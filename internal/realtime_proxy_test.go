package internal

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/subscriptions"
)

// Railway can use different internal proxy peers for the SSE connection and
// subscription POST. Only its edge-owned client IP should bind those requests.
func TestRealtimeProxyClientIdentity(t *testing.T) {
	for _, test := range []struct {
		name      string
		trusted   bool
		visitor   string
		forwarded string
		status    int
	}{
		{"unconfigured proxy peers reproduce rejected subscriptions", false, "203.0.113.50", "", 400},
		{"trusted edge identity survives a different proxy peer", true, "203.0.113.50", "", 204},
		{"untrusted forwarded-for cannot replace edge identity", true, "203.0.113.50", "198.51.100.99", 204},
		{"a genuinely different visitor is still rejected", true, "203.0.113.51", "", 400},
	} {
		t.Run(test.name, func(t *testing.T) {
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			if test.trusted {
				app.Settings().TrustedProxy.Headers = []string{"X-Real-IP"}
				app.Settings().TrustedProxy.UseLeftmostIP = false
			}
			if err := app.Save(app.Settings()); err != nil {
				t.Fatal(err)
			}
			router, err := apis.NewRouter(app)
			if err != nil {
				t.Fatal(err)
			}
			handler, err := router.BuildMux()
			if err != nil {
				t.Fatal(err)
			}

			connect := &core.RequestEvent{App: app}
			connect.Request = httptest.NewRequest("GET", "/api/realtime", nil)
			connect.Request.RemoteAddr = "10.0.0.1:4000"
			connect.Request.Header.Set("X-Real-IP", "203.0.113.50")
			client := subscriptions.NewDefaultClient()
			client.Set(apis.RealtimeClientIPKey, connect.RealIP())
			app.SubscriptionsBroker().Register(client)
			defer app.SubscriptionsBroker().Unregister(client.Id())

			body, _ := json.Marshal(map[string]any{"clientId": client.Id(), "subscriptions": []string{}})
			request := httptest.NewRequest("POST", "/api/realtime", bytes.NewReader(body))
			request.RemoteAddr = "10.0.0.2:5000"
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Real-IP", test.visitor)
			request.Header.Set("X-Forwarded-For", test.forwarded)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body.String())
			}
		})
	}
}
