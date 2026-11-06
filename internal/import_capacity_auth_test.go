package internal

import (
	"errors"
	"github.com/pocketbase/pocketbase/core"
	"io"
	"net/http/httptest"
	"testing"
)

type forbiddenImportBody struct{ reads int }

func (b *forbiddenImportBody) Read([]byte) (int, error) {
	b.reads++
	return 0, errors.New("unauthorized body read")
}
func (*forbiddenImportBody) Close() error { return nil }

var _ io.ReadCloser = (*forbiddenImportBody)(nil)

func TestImportRejectsNonDeveloperBeforeBodyAndCapacity(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler, _ := pushTestHTTP(t, app)
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	user := core.NewRecord(users)
	user.Set("email", "editor@example.com")
	user.Set("name", "Editor")
	user.SetPassword("editor-test-password")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	// An already busy slot makes wrong ordering observable without blocking.
	capacity := make(chan struct{}, 1)
	capacity <- struct{}{}
	app.Store().Set("primo.importCapacity", capacity)
	for _, endpoint := range []string{"/api/primo/import/" + site.Id, "/api/primo/import/" + site.Id + "/preview", "/api/primo/import-library"} {
		body := &forbiddenImportBody{}
		request := httptest.NewRequest("POST", endpoint, body)
		request.Header.Set("Authorization", token)
		request.Header.Set("Content-Type", "multipart/form-data; boundary=unused")
		pushHTTP(t, handler, request, 403)
		if body.reads != 0 {
			t.Fatalf("%s consumed unauthorized body", endpoint)
		}
		if len(capacity) != 1 {
			t.Fatal("authorization changed capacity")
		}
	}
}
