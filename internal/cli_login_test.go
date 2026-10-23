package internal

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func cliLoginTestServer(t *testing.T) (http.Handler, *cliLoginStore, string, core.App) {
	t.Helper()
	app := newPushTestApp(t)
	t.Cleanup(func() { app.ResetBootstrapState() })
	store := newCLILoginStore()
	if err := registerCLILoginEndpoints(app, store); err != nil {
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
	collection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	user := core.NewRecord(collection)
	user.Set("email", "cli-user@example.com")
	user.Set("serverRole", "editor")
	user.SetPassword("cli-test-password")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return handler, store, token, app
}

func cliLoginHTTP(t *testing.T, handler http.Handler, route string, body any, token string) (int, map[string]any) {
	t.Helper()
	data, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "http://cms.example.com/api/primo/cli-login/"+route, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	var value map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &value); err != nil {
		t.Fatalf("invalid response %d: %s", res.Code, res.Body.String())
	}
	if value["token"] != nil || value["device_code"] != nil {
		if res.Header().Get("Cache-Control") != "no-store" {
			t.Error("credential response may be cached")
		}
	}
	return res.Code, value
}

func TestCLILoginConsentAndOneTimeClaim(t *testing.T) {
	handler, store, browserToken, app := cliLoginTestServer(t)
	status, start := cliLoginHTTP(t, handler, "start", nil, "")
	if status != 200 {
		t.Fatal(status, start)
	}
	device := start["device_code"].(string)
	code := start["user_code"].(string)
	if len(device) != 64 || strings.Contains(start["verification_uri"].(string), device) {
		t.Fatal("device secret leaked into browser URL")
	}
	if _, ok := store.requests[sha256.Sum256([]byte(device))]; !ok {
		t.Fatal("secret must be stored by digest")
	}
	status, pending := cliLoginHTTP(t, handler, "token", map[string]string{"device_code": device}, "")
	if status != 202 || pending["error"] != "authorization_pending" || pending["token"] != nil {
		t.Fatal(status, pending)
	}
	status, _ = cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": code, "action": "approve"}, "")
	if status != 401 {
		t.Fatal("anonymous approval allowed", status)
	}
	status, _ = cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": code, "action": "approve"}, browserToken)
	if status != 200 {
		t.Fatal(status)
	}
	status, _ = cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": code, "action": "deny"}, browserToken)
	if status != 409 {
		t.Fatal("decision overwritten", status)
	}
	now := time.Now().Add(3 * time.Second)
	store.now = func() time.Time { return now }
	status, granted := cliLoginHTTP(t, handler, "token", map[string]string{"device_code": device}, "")
	if status != 200 || granted["token"] != browserToken {
		t.Fatal("claim did not retain the approved session", status)
	}
	user, err := app.FindAuthRecordByToken(granted["token"].(string), core.TokenTypeAuth)
	if err != nil || user.GetString("serverRole") != "editor" {
		t.Fatal("account permissions changed", err)
	}
	status, _ = cliLoginHTTP(t, handler, "token", map[string]string{"device_code": device}, "")
	if status != 400 {
		t.Fatal("login request reused", status)
	}
	// A browser code, even with the browser's credentials, is not a device secret.
	status, _ = cliLoginHTTP(t, handler, "token", map[string]string{"device_code": code}, browserToken)
	if status != 400 {
		t.Fatal("browser code claimed credentials", status)
	}
}

func TestCLILoginLimitsExpiryAndDenial(t *testing.T) {
	handler, store, token, _ := cliLoginTestServer(t)
	_, start := cliLoginHTTP(t, handler, "start", nil, "")
	body := map[string]string{"device_code": start["device_code"].(string)}
	cliLoginHTTP(t, handler, "token", body, "")
	status, result := cliLoginHTTP(t, handler, "token", body, "")
	if status != 429 || result["error"] != "slow_down" {
		t.Fatal("polling is unbounded", status, result)
	}
	cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": start["user_code"].(string), "action": "deny"}, token)
	status, result = cliLoginHTTP(t, handler, "token", body, "")
	if status != 403 || result["error"] != "access_denied" {
		t.Fatal(status, result)
	}
	for i := 0; i < 5; i++ {
		status, start = cliLoginHTTP(t, handler, "start", nil, "")
		if status != 200 {
			t.Fatal(status)
		}
	}
	status, _ = cliLoginHTTP(t, handler, "start", nil, "")
	if status != 429 {
		t.Fatal("pending requests are unbounded", status)
	}
	future := time.Now().Add(6 * time.Minute)
	store.now = func() time.Time { return future }
	status, result = cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": start["user_code"].(string), "action": "approve"}, token)
	if status != 410 {
		t.Fatal(status, result)
	}
	status, result = cliLoginHTTP(t, handler, "token", map[string]string{"device_code": start["device_code"].(string)}, "")
	if status != 410 || result["error"] != "expired_token" {
		t.Fatal(status, result)
	}
	status, _ = cliLoginHTTP(t, handler, "start", nil, "")
	if status != 200 {
		t.Fatal("expired pending requests were not reclaimed", status)
	}
}

func TestCLILoginClaimIsAtomicAndRevocationIsRespected(t *testing.T) {
	handler, _, token, app := cliLoginTestServer(t)
	_, start := cliLoginHTTP(t, handler, "start", nil, "")
	cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": start["user_code"].(string), "action": "approve"}, token)
	var wg sync.WaitGroup
	statuses := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, _ := cliLoginHTTP(t, handler, "token", map[string]string{"device_code": start["device_code"].(string)}, "")
			statuses <- status
		}()
	}
	wg.Wait()
	close(statuses)
	successes := 0
	for status := range statuses {
		if status == 200 {
			successes++
		}
	}
	if successes != 1 {
		t.Fatal("claim was not single-use", successes)
	}
	_, start = cliLoginHTTP(t, handler, "start", nil, "")
	cliLoginHTTP(t, handler, "approve", map[string]string{"user_code": start["user_code"].(string), "action": "approve"}, token)
	user, _ := app.FindAuthRecordByToken(token, core.TokenTypeAuth)
	user.RefreshTokenKey()
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	status, result := cliLoginHTTP(t, handler, "token", map[string]string{"device_code": start["device_code"].(string)}, "")
	if status != 403 || result["token"] != nil {
		t.Fatal("revoked browser session granted access", status)
	}
}
