package internal

import (
	"archive/zip"
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestImportUploadsAcceptArchivesAboveDefaultBodyLimit(t *testing.T) {
	// Store rather than compress the padding so the actual HTTP request, not
	// just the expanded archive, exceeds PocketBase's default 32 MiB limit.
	var archive bytes.Buffer
	w := zip.NewWriter(&archive)
	for name, data := range map[string][]byte{
		"site.yaml":           []byte("name: Large import\n"),
		"library/groups.yaml": []byte("[]\n"),
		"padding.bin":         make([]byte, apis.DefaultMaxBodySize+1),
	} {
		file, err := w.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}

	for _, route := range []string{"site", "preview", "library", "bootstrap"} {
		t.Run(route, func(t *testing.T) {
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			handler, token := pushTestHTTP(t, app)
			var endpoint, revision string
			switch route {
			case "site", "preview":
				site := createImportTestSite(t, app)
				endpoint = "/api/primo/import/" + site.Id
				revision = mustPushState(t, app, site.Id).Revision
				if route == "preview" {
					endpoint += "/preview"
				}
			case "library":
				endpoint = "/api/primo/import-library"
			case "bootstrap":
				endpoint = "/api/primo/bootstrap"
			}
			request := pushRequest(t, endpoint, token, revision, false, archive.Bytes())
			// httptest does not perform net/http's automatic multipart cleanup.
			defer func() {
				if request.MultipartForm != nil {
					request.MultipartForm.RemoveAll()
				}
			}()
			pushHTTP(t, handler, request, http.StatusOK)
		})
	}
}

func TestImportUploadBodyLimitsRemainScopedAndBounded(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.POST("/test/ordinary-request", func(e *core.RequestEvent) error {
			return e.NoContent(http.StatusNoContent)
		})
		return e.Next()
	})
	handler, token := pushTestHTTP(t, app)
	for _, endpoint := range []string{
		"/api/primo/import/largeuploadsite",
		"/api/primo/import/largeuploadsite/preview",
		"/api/primo/import-library",
		"/api/primo/bootstrap",
	} {
		t.Run(endpoint, func(t *testing.T) {
			request := pushRequest(t, endpoint, token, "", false, nil)
			request.ContentLength = (512 << 20) + 1
			pushHTTP(t, handler, request, http.StatusRequestEntityTooLarge)
		})
	}
	request := httptest.NewRequest(http.MethodPost, "/test/ordinary-request", nil)
	request.ContentLength = apis.DefaultMaxBodySize + 1
	pushHTTP(t, handler, request, http.StatusRequestEntityTooLarge)
}
