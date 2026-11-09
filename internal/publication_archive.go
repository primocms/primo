package internal

import (
	"archive/zip"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// activeBuild is the build a site's visitors are served right now: the
// immutable prefix of the last tracked publication, or the legacy
// sites/{host}/ tree when no tracked publication has activated yet.
type activeBuild struct {
	Prefix      string
	Revision    string
	PublishedAt string
}

var errNoActiveBuild = errors.New("site has no published build")

func findActiveBuild(app core.App, site *core.Record) (activeBuild, error) {
	record, err := publicationRecord(app, site.Id)
	if err != nil {
		return activeBuild{}, err
	}
	build := activeBuild{Prefix: record.GetString("prefix"), Revision: record.GetString("published_revision"), PublishedAt: record.GetString("published_at")}
	if build.Prefix == "" {
		// Same fallback as ServeSites. Legacy builds carry no revision.
		build.Prefix, build.Revision = "sites/"+site.GetString("host"), ""
	}
	system, err := app.NewFilesystem()
	if err != nil {
		return activeBuild{}, err
	}
	defer system.Close()
	exists, err := system.Exists(build.Prefix + "/index.html")
	if err != nil {
		return activeBuild{}, err
	}
	if !exists {
		return activeBuild{}, errNoActiveBuild
	}
	return build, nil
}

// Archive download tokens are stateless: a JWT bound to the site and the
// build that was active when it was issued. The key is derived from the
// superusers' token secret, so rotating that secret revokes every link.
const archiveTokenType = "primo_publication_archive"

func archiveTokenKey(app core.App) (string, error) {
	superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return "", err
	}
	if superusers.AuthToken.Secret == "" {
		return "", errors.New("missing token secret")
	}
	return superusers.AuthToken.Secret + ":" + archiveTokenType, nil
}

func newArchiveToken(app core.App, siteID string, build activeBuild, duration time.Duration) (string, error) {
	key, err := archiveTokenKey(app)
	if err != nil {
		return "", err
	}
	return security.NewJWT(jwt.MapClaims{"type": archiveTokenType, "site": siteID, "revision": build.Revision, "published_at": build.PublishedAt}, key, duration)
}

func validArchiveToken(app core.App, token, siteID string, build activeBuild) bool {
	key, err := archiveTokenKey(app)
	if err != nil {
		return false
	}
	claims, err := security.ParseJWT(token, key)
	if err != nil {
		return false // includes expired tokens
	}
	return claims["type"] == archiveTokenType && claims["site"] == siteID &&
		claims["revision"] == build.Revision && claims["published_at"] == build.PublishedAt
}

// writeBuildArchive streams every file of the build into a zip, with paths
// relative to the build prefix.
func writeBuildArchive(app core.App, prefix string, w io.Writer) error {
	system, err := app.NewFilesystem()
	if err != nil {
		return err
	}
	defer system.Close()
	files, err := system.List(prefix + "/")
	if err != nil {
		return err
	}
	archive := zip.NewWriter(w)
	for _, file := range files {
		if file.IsDir {
			continue
		}
		name := strings.TrimPrefix(file.Key, prefix+"/")
		if name == "" || name == file.Key || strings.HasPrefix(name, "/") || strings.Contains("/"+name+"/", "/../") {
			continue
		}
		entry, err := archive.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Deflate, Modified: file.ModTime})
		if err != nil {
			return err
		}
		reader, err := system.GetReader(file.Key)
		if err != nil {
			return err
		}
		_, err = io.Copy(entry, reader)
		reader.Close()
		if err != nil {
			return err
		}
	}
	return archive.Close()
}

func registerPublicationArchiveEndpoint(pb *pocketbase.PocketBase, event *core.ServeEvent) {
	// Returns the build visitors are served, so external hosting (GitHub Pages,
	// Netlify, a plain web server) never has to know the storage layout.
	event.Router.GET("/api/primo/publication/{siteId}/archive", func(e *core.RequestEvent) error {
		token := e.Request.URL.Query().Get("token")
		var site *core.Record
		var err error
		if token == "" {
			if site, err = authorizePublication(pb, e); err != nil {
				return err
			}
		} else if site, err = pb.FindRecordById("sites", e.Request.PathValue("siteId")); err != nil {
			return e.ForbiddenError("Invalid or expired download link.", nil)
		}
		build, err := findActiveBuild(pb, site)
		if err != nil && !errors.Is(err, errNoActiveBuild) {
			return err
		}
		// A link stays valid only while the build it was issued for is active.
		if token != "" && !validArchiveToken(pb, token, site.Id, build) {
			return e.ForbiddenError("Invalid or expired download link.", nil)
		}
		if err != nil {
			return e.NotFoundError("This site has not been published yet.", nil)
		}
		filename := sanitizeFilename(site.GetString("host"))
		if build.Revision != "" {
			filename += "-" + build.Revision[:min(len(build.Revision), 12)]
		}
		disposition := mime.FormatMediaType("attachment", map[string]string{"filename": asciiHeaderFilename(filename) + ".zip"})
		if disposition == "" {
			disposition = "attachment"
		}
		header := e.Response.Header()
		header.Set("Content-Type", "application/zip")
		header.Set("Content-Disposition", disposition)
		header.Set("Cache-Control", "no-store")
		header.Set("X-Primo-Revision", build.Revision)
		e.Response.WriteHeader(http.StatusOK)
		// Headers are sent; a failure now can only cut the zip short, which
		// the client detects as a corrupt archive.
		if err := writeBuildArchive(pb, build.Prefix, e.Response); err != nil {
			pb.Logger().Error("publication archive", "site", site.Id, "error", err)
		}
		return nil
	})
}
