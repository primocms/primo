package internal

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

type goLiveReceiver struct {
	mu            sync.Mutex
	authorization string
	body          map[string]any
	status        int
	answer        string
}

func (r *goLiveReceiver) ServeHTTP(w http.ResponseWriter, request *http.Request) {
	r.mu.Lock()
	defer r.mu.Unlock()
	data, _ := io.ReadAll(request.Body)
	r.authorization = request.Header.Get("Authorization")
	r.body = map[string]any{}
	json.Unmarshal(data, &r.body)
	w.WriteHeader(r.status)
	io.WriteString(w, r.answer)
}

func TestGoLiveWebhook(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, _, _ := pushFixture(t, app)
	if err := RegisterLiveSiteEndpoints(app); err != nil {
		t.Fatal(err)
	}
	handler, token := publicationHTTP(t, app)
	receiver := &goLiveReceiver{status: http.StatusNoContent}
	server := httptest.NewTLSServer(receiver)
	defer server.Close()
	client := server.Client()
	client.Timeout, client.CheckRedirect = goLiveClient.Timeout, goLiveClient.CheckRedirect
	previous := goLiveClient
	goLiveClient = client
	defer func() { goLiveClient = previous }()

	settings := "/api/primo/sites/" + site.Id + "/live-site"
	goLive := "/api/primo/publication/" + site.Id + "/go-live"
	pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 400)
	pushHTTP(t, handler, publicationRequest("POST", settings, token, `{"go_live_webhook_url":"http://example.org/hook"}`), 400)
	response := pushHTTP(t, handler, publicationRequest("POST", settings, token, `{"live_url":"https://example.org","go_live_webhook_url":"`+server.URL+`/dispatches","go_live_webhook_secret":"s3cret"}`), 200)
	if strings.Contains(response.Body.String(), "s3cret") || !strings.Contains(response.Body.String(), `"go_live_webhook_secret_set":true`) {
		t.Fatal(response.Body.String())
	}
	// The secret never leaves the server, not even to developers.
	record := pushHTTP(t, handler, publicationRequest("GET", "/api/collections/sites/records/"+site.Id, token, ""), 200)
	if strings.Contains(record.Body.String(), "s3cret") || strings.Contains(record.Body.String(), "go_live_webhook_secret") {
		t.Fatal(record.Body.String())
	}
	// Saving the live URL alone keeps the webhook and its secret.
	response = pushHTTP(t, handler, publicationRequest("POST", settings, token, `{"live_url":"https://example.org/"}`), 200)
	if !strings.Contains(response.Body.String(), `"go_live_webhook_secret_set":true`) || !strings.Contains(response.Body.String(), server.URL) {
		t.Fatal(response.Body.String())
	}

	pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 409)
	compiledHome(t, app, site, "<h1>Live build</h1>")
	build := publishTracked(t, app, site)
	pushHTTP(t, handler, publicationRequest("POST", goLive, "", ""), 403)
	pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 200)

	if receiver.authorization != "Bearer s3cret" || receiver.body["event_type"] != "primo_go_live" {
		t.Fatalf("webhook request: %q %v", receiver.authorization, receiver.body)
	}
	payload, _ := receiver.body["client_payload"].(map[string]any)
	if payload["site_id"] != site.Id || payload["revision"] != build.Revision || payload["live_url"] != "https://example.org" || payload["host"] != site.GetString("host") || payload["expires_at"] == "" {
		t.Fatalf("payload: %v", payload)
	}
	download, _ := payload["download_url"].(string)
	index := strings.Index(download, "/api/primo/publication/"+site.Id+"/archive?token=")
	if index < 0 {
		t.Fatal(download)
	}
	archive := pushHTTP(t, handler, publicationRequest("GET", download[index:], "", ""), 200)
	if archiveFiles(t, archive.Body.Bytes())["index.html"] != "<h1>Live build</h1>" {
		t.Fatal("download link served another build")
	}

	// Receiver errors reach the editor with their status and an excerpt.
	receiver.status, receiver.answer = http.StatusUnprocessableEntity, `{"message":"Bad credentials"}`
	failed := pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 502)
	if !strings.Contains(failed.Body.String(), "422") || !strings.Contains(failed.Body.String(), "Bad credentials") {
		t.Fatal(failed.Body.String())
	}
	// Redirects are not followed.
	receiver.status, receiver.answer = http.StatusFound, ""
	pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 502)

	// A plain http:// target stored by other means is refused too.
	site, _ = app.FindRecordById("sites", site.Id)
	site.Set("go_live_webhook_url", "http://example.org/hook")
	if err := app.Save(site); err != nil {
		t.Fatal(err)
	}
	pushHTTP(t, handler, publicationRequest("POST", goLive, token, ""), 400)

	// Clearing the webhook clears its secret.
	response = pushHTTP(t, handler, publicationRequest("POST", settings, token, `{"live_url":"https://example.org","go_live_webhook_url":""}`), 200)
	if !strings.Contains(response.Body.String(), `"go_live_webhook_secret_set":false`) {
		t.Fatal(response.Body.String())
	}
}
