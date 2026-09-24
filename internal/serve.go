package internal

import (
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func ServeSites(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		fs, err := pb.NewFilesystem()
		if err != nil {
			return err
		}

		serveEvent.Router.GET("/{path...}", func(requestEvent *core.RequestEvent) error {
			// In dev mode, redirect bare localhost to dashboard — but not when
			// the request is a site preview (dashboard iframes hit `/?_site=ID`),
			// otherwise the iframe bounces to the dashboard instead of rendering
			// the site.
			if DevMode && requestEvent.Request.URL.Query().Get("_site") == "" {
				host := requestEvent.Request.Host
				// Strip port
				if idx := strings.LastIndex(host, ":"); idx != -1 {
					host = host[:idx]
				}
				reqPath := requestEvent.Request.PathValue("path")
				// Check for bare localhost (no subdomain)
				if (host == "localhost" || host == "127.0.0.1") && (reqPath == "" || reqPath == "/") {
					return requestEvent.Redirect(302, "/admin/dashboard")
				}
			}
			// Resolve site ID (explicit param) or from referrer URL for host mapping.
			siteId := requestEvent.Request.URL.Query().Get("_site")
			referer := requestEvent.Request.Header.Get("Referer")
			if siteId == "" && referer != "" {
				refererUrl, err := url.Parse(referer)
				if err != nil {
					return err
				}

				if refererUrl.Host == requestEvent.Request.Host {
					siteId = refererUrl.Query().Get("_site")
				}
			}

			reqHost := requestEvent.Request.Host
			var site *core.Record
			if siteId != "" {
				site, err = pb.FindRecordById("sites", siteId)
				if err != nil {
					return err
				}

				// Override host based on the resolved site ID
				reqHost = site.GetString("host")
			}

			reqPath := requestEvent.Request.PathValue("path")
			fileKey := "sites/" + reqHost + "/" + reqPath
			fileName := path.Base(fileKey)

			isHome := false
			if reqPath == "" {
				// Rewrite home page
				isHome = true
				fileKey = fileKey + "index.html"
				fileName = "index.html"
			}

			exists, err := fs.Exists(fileKey)
			if err != nil {
				return err
			} else if !exists && isHome {
				// No published home. For preview requests (`?_site=ID`) serve the
				// homepage preview stored on the site record instead — redirecting
				// to /admin would render the admin app inside dashboard thumbnails,
				// which reads as a broken site.
				if siteId != "" && serveSitePreview(pb, requestEvent, fs, site) {
					return nil
				}
				// Home not found, redirect to site editor
				return requestEvent.Redirect(302, "/admin")
			} else if !exists && path.Ext(fileKey) == "" {
				// Fallback to index.html
				fileKey = strings.TrimSuffix(fileKey, "/") + "/index.html"
				fileName = "index.html"
			}

			reader, err := fs.GetReader(fileKey)
			if err != nil {
				return err
			}
			defer reader.Close()

			requestEvent.Response.Header().Set("Content-Security-Policy", "frame-ancestors *")

			// Preview requests (`?_site=ID`, incl. subresources resolved via the
			// referrer) must never be served from cache: the preview iframe's
			// cache-busting `v` token changes only once per publish, so without
			// this the browser would keep showing the build it cached under the
			// new URL — making even a full dashboard refresh look stale. Real
			// (host-based) site traffic keeps its normal caching behavior.
			if siteId != "" {
				requestEvent.Response.Header().Set("Cache-Control", "no-store")
			}

			// In dev mode, inject the dev indicator into HTML files
			if DevMode && strings.HasSuffix(strings.ToLower(fileName), ".html") {
				content, err := io.ReadAll(reader)
				if err != nil {
					return err
				}
				modified := InjectDevIndicator(content)
				requestEvent.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
				requestEvent.Response.Write(modified)
				return nil
			}

			http.ServeContent(
				requestEvent.Response,
				requestEvent.Request,
				fileName,
				reader.ModTime(),
				reader,
			)
			return nil
		}).Unbind(apis.DefaultSecurityHeadersMiddlewareId)

		return serveEvent.Next()
	})

	return nil
}

// serveSitePreview serves the homepage preview file stored on a site record's
// `preview` field (written by the publish worker on every publish). Used as a
// fallback when a `?_site=ID` request finds no published home yet, so dashboard
// thumbnail iframes get a real homepage instead of bouncing to the admin app.
// Returns false when the site has no preview file or it can't be served.
func serveSitePreview(pb *pocketbase.PocketBase, requestEvent *core.RequestEvent, system *filesystem.System, site *core.Record) bool {
	previewName := site.GetString("preview")
	if previewName == "" {
		return false
	}

	collection, err := pb.FindCollectionByNameOrId("sites")
	if err != nil {
		return false
	}

	reader, err := system.GetReader(collection.Id + "/" + site.Id + "/" + previewName)
	if err != nil {
		return false
	}
	defer reader.Close()

	requestEvent.Response.Header().Set("Content-Security-Policy", "frame-ancestors *")
	requestEvent.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	requestEvent.Response.Header().Set("Cache-Control", "no-store")
	http.ServeContent(
		requestEvent.Response,
		requestEvent.Request,
		previewName,
		reader.ModTime(),
		reader,
	)
	return true
}
