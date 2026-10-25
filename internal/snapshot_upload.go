package internal

import (
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
)

// RegisterRecoverySnapshotUploads streams snapshot files to multipart temporary
// storage instead of retaining PocketBase v0.35's additional full-body heap copy.
// PocketBase's normal 32 MiB multipart memory threshold spills larger files to
// disk. Its dynamic body limits, collection rate checks, and record authorization
// remain in the existing handlers, with no eager parsing before those checks.
func RegisterRecoverySnapshotUploads(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.Bind(&hook.Handler[*core.RequestEvent]{
			Id:       "primoSnapshotStream",
			Priority: apis.DefaultBodyLimitMiddlewarePriority - 1,
			Func: func(e *core.RequestEvent) error {
				if e.Request.Pattern != "POST /api/collections/{collection}/records" ||
					!strings.HasPrefix(e.Request.Header.Get("Content-Type"), "multipart/form-data") {
					return e.Next()
				}
				collection, err := e.App.FindCachedCollectionByNameOrId(e.Request.PathValue("collection"))
				if err != nil || collection.Name != "site_snapshots" {
					return e.Next()
				}
				// Auth tokens have already been loaded by PocketBase's earlier
				// middleware. Reject guests before reading or spooling any bytes.
				if e.Auth == nil {
					return e.UnauthorizedError("Authentication required.", nil)
				}
				body, ok := e.Request.Body.(*router.RereadableReadCloser)
				if !ok {
					return e.InternalServerError("Unexpected snapshot request body wrapper.", nil)
				}
				// Multipart parsing caches Form and MultipartForm, so subsequent
				// BindBody/FindUploadedFiles calls do not need to replay the body.
				// Unwrap before BodyLimit installs its byte-counting reader.
				e.Request.Body = body.ReadCloser
				defer func() {
					if e.Request.MultipartForm != nil {
						e.Request.MultipartForm.RemoveAll()
					}
				}()
				return e.Next()
			},
		})
		return event.Next()
	})
	return nil
}
