package internal

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestCLILoginAuthorization(t *testing.T) {
	app := newPushTestApp(t)
	if err := RegisterCLILoginEndpoints(app); err != nil {
		t.Fatal(err)
	}
	handler, token := pushTestHTTP(t, app)
	post := func(path, auth string, body map[string]any) *httptest.ResponseRecorder {
		data, _ := json.Marshal(body)
		request := httptest.NewRequest("POST", "http://cms.example.com"+path, bytes.NewReader(data))
		request.Header.Set("Content-Type", "application/json")
		if auth != "" {
			request.Header.Set("Authorization", "Bearer "+auth)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}
	start := post("/api/primo/cli-login", "", nil)
	if start.Code != 200 {
		t.Fatal(start.Body.String())
	}
	var pending map[string]string
	if err := json.Unmarshal(start.Body.Bytes(), &pending); err != nil {
		t.Fatal(err)
	}
	if len(pending["code"]) != 64 || len(pending["secret"]) != 64 || pending["code"] == pending["secret"] {
		t.Fatal("invalid code/secret separation")
	}
	if start.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("credentials must not be cached")
	}
	checkBody := map[string]any{"code": pending["code"], "secret": pending["secret"]}
	check := post("/api/primo/cli-login/check", "", checkBody)
	if check.Code != 200 || !strings.Contains(check.Body.String(), "pending") {
		t.Fatal(check.Body.String())
	}
	wrong := post("/api/primo/cli-login/check", "", map[string]any{"code": pending["code"], "secret": "wrong"})
	if wrong.Code == 200 {
		t.Fatal("wrong poll secret accepted")
	}
	unauthorized := post("/api/primo/cli-login/approve", "", map[string]any{"code": pending["code"]})
	if unauthorized.Code != 401 {
		t.Fatal("approval must require a user session")
	}
	approve := post("/api/primo/cli-login/approve", token, map[string]any{"code": pending["code"]})
	if approve.Code != 200 || strings.Contains(approve.Body.String(), "token") {
		t.Fatal(approve.Body.String())
	}
	repeated := post("/api/primo/cli-login/approve", token, map[string]any{"code": pending["code"]})
	if repeated.Code == 200 {
		t.Fatal("request approved twice")
	}
	authenticated := post("/api/primo/cli-login/check", "", checkBody)
	var result map[string]string
	if err := json.Unmarshal(authenticated.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if authenticated.Code != 200 || result["state"] != "authenticated" || result["token"] == "" {
		t.Fatal(authenticated.Body.String())
	}
	if _, err := app.FindAuthRecordByToken(result["token"], core.TokenTypeAuth); err != nil {
		t.Fatal("issued invalid account token", err)
	}
	if post("/api/primo/cli-login/check", "", checkBody).Code == 200 {
		t.Fatal("consumed request was replayed")
	}
}

func TestCLILoginPendingCapacity(t *testing.T) {
	app := newPushTestApp(t)
	if err := RegisterCLILoginEndpoints(app); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}); err != nil {
		t.Fatal(err)
	}
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 101; i++ {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "http://cms.example.com/api/primo/cli-login", strings.NewReader("{}")))
		expected := 200
		if i == 100 {
			expected = 429
		}
		if response.Code != expected {
			t.Fatalf("request %d: HTTP %d, wanted %d: %s", i, response.Code, expected, response.Body.String())
		}
	}
}

func TestCLILoginExpires(t *testing.T) {
	app := newPushTestApp(t)
	clock := time.Now()
	if err := registerCLILoginEndpoints(app, func() time.Time { return clock }); err != nil {
		t.Fatal(err)
	}
	handler, token := pushTestHTTP(t, app)
	start := httptest.NewRecorder()
	handler.ServeHTTP(start, httptest.NewRequest("POST", "http://cms.example.com/api/primo/cli-login", strings.NewReader("{}")))
	var pending map[string]string
	if err := json.Unmarshal(start.Body.Bytes(), &pending); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(cliLoginTTL + time.Second)
	for _, path := range []string{"approve", "check"} {
		data, _ := json.Marshal(pending)
		request := httptest.NewRequest("POST", "http://cms.example.com/api/primo/cli-login/"+path, bytes.NewReader(data))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code == 200 {
			t.Fatalf("expired request accepted by %s", path)
		}
	}
}

func TestAdminSetupPreservesCLILoginContinuation(t *testing.T) {
	app := newPushTestApp(t)
	if err := RegisterAdminApp(app); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}); err != nil {
		t.Fatal(err)
	}
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	destination := "/admin/cli-login?code=" + strings.Repeat("a", 64)
	request := httptest.NewRequest("GET", "https://cms.example.com"+destination, nil)
	request.RemoteAddr = "192.0.2.10:1234"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 302 {
		t.Fatalf("expected setup redirect, got %d: %s", response.Code, response.Body.String())
	}
	location, err := url.Parse(response.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if location.Path != "/admin/setup" || location.Query().Get("next") != destination {
		t.Fatal("lost authorization continuation", location)
	}
}
