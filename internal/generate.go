package internal

import (
	"bytes"
	"crypto/sha256"
	"encoding/xml"
	"io"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

// destinationMatchesSource reports whether dstKey already holds the exact bytes
// at srcKey, so the copy can be skipped. It reads both files and compares their
// sha256 (mirroring the upload reconcile in import.go). On any uncertainty (read
// error, missing destination) it returns false so the caller copies — we never
// skip on doubt. A cheap size check short-circuits before the full read.
func destinationMatchesSource(system *filesystem.System, srcKey, dstKey string) bool {
	srcAttr, err := system.Attributes(srcKey)
	if err != nil {
		return false
	}
	dstAttr, err := system.Attributes(dstKey)
	if err != nil {
		return false
	}
	if srcAttr.Size != dstAttr.Size {
		return false
	}
	// Prefer backend-provided MD5 when both sides have it (no full read).
	if len(srcAttr.MD5) > 0 && len(dstAttr.MD5) > 0 {
		return bytes.Equal(srcAttr.MD5, dstAttr.MD5)
	}
	// Fall back to hashing the bytes (local-disk backend leaves MD5 nil).
	srcHash, ok := hashFile(system, srcKey)
	if !ok {
		return false
	}
	dstHash, ok := hashFile(system, dstKey)
	if !ok {
		return false
	}
	return srcHash == dstHash
}

func hashFile(system *filesystem.System, key string) ([sha256.Size]byte, bool) {
	reader, err := system.GetReader(key)
	if err != nil {
		return [sha256.Size]byte{}, false
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return [sha256.Size]byte{}, false
	}
	return sha256.Sum256(data), true
}

// copyIfChanged copies srcKey to dstKey unless the destination already holds the
// same bytes. Either way dstKey is a live artifact, so the caller records it for
// the cleanup pass (which deletes anything not in the returned set).
func copyIfChanged(system *filesystem.System, srcKey, dstKey string) error {
	if destinationMatchesSource(system, srcKey, dstKey) {
		return nil
	}
	return system.Copy(srcKey, dstKey)
}

func generateSymbols(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("site_symbols")
	if err != nil {
		return nil, err
	}

	symbols, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(symbols))
	for _, symbol := range symbols {
		name := symbol.GetString("compiled_js")
		if name == "" {
			continue
		}

		sourceKey := collection.Id + "/" + symbol.Id + "/" + name
		destinationKey := "sites/" + site.GetString("host") + "/_symbols/" + symbol.Id + ".js"
		if err := copyIfChanged(system, sourceKey, destinationKey); err != nil {
			return nil, err
		}

		newFiles = append(newFiles, destinationKey)
	}

	return newFiles, nil
}

func generateUploads(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("site_uploads")
	if err != nil {
		return nil, err
	}

	uploads, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(uploads))
	for _, upload := range uploads {
		name := upload.GetString("file")
		sourceKey := collection.Id + "/" + upload.Id + "/" + name
		destinationKey := "sites/" + site.GetString("host") + "/_uploads/" + name
		if err := copyIfChanged(system, sourceKey, destinationKey); err != nil {
			return nil, err
		}

		newFiles = append(newFiles, destinationKey)
	}

	return newFiles, nil
}

func generatePages(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("pages")
	if err != nil {
		return nil, err
	}

	pages, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(pages))
	for _, page := range pages {
		if page.GetString("parent") == "" {
			newPageFiles, err := generatePage(
				system,
				collection,
				site,
				pages,
				page,
				"",
			)
			if err != nil {
				return nil, err
			}

			newFiles = append(newFiles, newPageFiles...)
		}
	}

	return newFiles, nil
}

func generatePage(
	system *filesystem.System,
	collection *core.Collection,
	site *core.Record,
	pages []*core.Record,
	page *core.Record,
	path string,
) ([]string, error) {
	name := page.GetString("compiled_html")
	sourceKey := collection.Id + "/" + page.Id + "/" + name
	destinationKey := "sites/" + site.GetString("host") + path + "/index.html"
	if err := copyIfChanged(system, sourceKey, destinationKey); err != nil {
		return nil, err
	}

	newFiles := []string{destinationKey}
	for _, subPage := range pages {
		if subPage.GetString("parent") == page.Id {
			newSubPageFiles, err := generatePage(
				system,
				collection,
				site,
				pages,
				subPage,
				path+"/"+subPage.GetString("slug"),
			)
			if err != nil {
				return nil, err
			}

			newFiles = append(newFiles, newSubPageFiles...)
		}
	}

	return newFiles, nil
}

// Sitemap XML structures
type sitemapURL struct {
	XMLName xml.Name `xml:"url"`
	Loc     string   `xml:"loc"`
}

type sitemap struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func generateSitemap(system *filesystem.System, site *core.Record, pages []*core.Record) (string, error) {
	host := site.GetString("host")
	baseURL := "https://" + host

	var urls []sitemapURL

	// Collect all page paths recursively
	var collectPaths func(page *core.Record, path string)
	collectPaths = func(page *core.Record, path string) {
		urls = append(urls, sitemapURL{
			Loc: baseURL + path + "/",
		})

		for _, subPage := range pages {
			if subPage.GetString("parent") == page.Id {
				collectPaths(subPage, path+"/"+subPage.GetString("slug"))
			}
		}
	}

	// Start from root pages (no parent)
	for _, page := range pages {
		if page.GetString("parent") == "" {
			collectPaths(page, "")
		}
	}

	// Generate XML
	sm := sitemap{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)
	encoder := xml.NewEncoder(&buf)
	encoder.Indent("", "  ")
	if err := encoder.Encode(sm); err != nil {
		return "", err
	}

	// Write sitemap to filesystem, but only when it actually changed. The
	// sitemap only differs when pages are added/removed/renamed/reparented, so
	// a content-only edit skips this upload (and the CDN cache bust it implies).
	destinationKey := "sites/" + host + "/sitemap.xml"
	if existingHash, ok := hashFile(system, destinationKey); !ok || existingHash != sha256.Sum256(buf.Bytes()) {
		if err := system.Upload(buf.Bytes(), destinationKey); err != nil {
			return "", err
		}
	}

	return destinationKey, nil
}

func RegisterGenerateEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/primo/generate", func(requestEvent *core.RequestEvent) error {
			body := struct {
				SiteId string `json:"site_id"`
			}{}
			requestEvent.BindBody(&body)

			if body.SiteId == "" {
				return requestEvent.BadRequestError("site_id missing", nil)
			}

			site, err := pb.FindRecordById("sites", body.SiteId)
			if err != nil {
				return err
			}

			info, err := requestEvent.RequestInfo()
			if err != nil {
				return err
			}

			canAccess, err := requestEvent.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			if !canAccess {
				return requestEvent.ForbiddenError("", err)
			}

			system, err := pb.NewFilesystem()
			if err != nil {
				return err
			}

			existingFiles, err := system.List("sites/" + site.GetString("host") + "/")
			if err != nil {
				return err
			}

			symbolFiles, err := generateSymbols(pb, system, site)
			if err != nil {
				return err
			}

			uploadFiles, err := generateUploads(pb, system, site)
			if err != nil {
				return err
			}

			pageFiles, err := generatePages(pb, system, site)
			if err != nil {
				return err
			}

			// Generate sitemap
			pagesCollection, err := pb.FindCollectionByNameOrId("pages")
			if err != nil {
				return err
			}
			pages, err := pb.FindRecordsByFilter(
				pagesCollection.Id,
				"site = {:site}",
				"",
				0,
				0,
				dbx.Params{"site": site.Id},
			)
			if err != nil {
				return err
			}
			sitemapFile, err := generateSitemap(system, site, pages)
			if err != nil {
				return err
			}

		cleanup:
			for _, file := range existingFiles {
				if file.IsDir {
					continue
				}

				for _, symbolFile := range symbolFiles {
					if file.Key == symbolFile {
						continue cleanup
					}
				}

				for _, uploadFile := range uploadFiles {
					if file.Key == uploadFile {
						continue cleanup
					}
				}

				for _, pageFile := range pageFiles {
					if file.Key == pageFile {
						continue cleanup
					}
				}

				if file.Key == sitemapFile {
					continue cleanup
				}

				if err := system.Delete(file.Key); err != nil {
					return err
				}
			}

			return nil
		})
		return serveEvent.Next()
	})

	return nil
}
