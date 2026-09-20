package internal

import (
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

//go:embed forms-runtime.js
var formsAssets embed.FS

var formName = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
var formRequestKey = regexp.MustCompile(`^[a-zA-Z0-9_-]{16,80}$`)

type FormField struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Required  bool   `json:"required,omitempty"`
	MaxLength int    `json:"maxLength,omitempty"`
}
type FormDefinition struct {
	Version  int         `json:"version"`
	Name     string      `json:"name"`
	Enabled  bool        `json:"enabled"`
	Fields   []FormField `json:"fields"`
	NotifyTo string      `json:"notifyTo,omitempty"`
}

func (d FormDefinition) validate() error {
	if d.Version != 1 {
		return errors.New("unsupported form version; expected 1")
	}
	if strings.TrimSpace(d.Name) == "" || len(d.Name) > 120 {
		return errors.New("name must contain 1–120 characters")
	}
	if len(d.Fields) == 0 || len(d.Fields) > 30 {
		return errors.New("forms need 1–30 fields")
	}
	seen := map[string]bool{}
	for _, f := range d.Fields {
		if !formName.MatchString(f.Name) || seen[f.Name] {
			return fmt.Errorf("invalid or duplicate field: %s", f.Name)
		}
		seen[f.Name] = true
		if f.Type != "text" && f.Type != "email" && f.Type != "textarea" {
			return fmt.Errorf("unsupported field type: %s", f.Type)
		}
		if f.MaxLength < 0 || f.MaxLength > 10000 {
			return errors.New("maxLength must be between 0 and 10000")
		}
	}
	if d.NotifyTo != "" && !validFormEmail(d.NotifyTo) {
		return errors.New("notifyTo must be a single email address")
	}
	return nil
}

func validFormEmail(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && address.Address == value && !strings.ContainsAny(value, "\r\n")
}

func (d FormDefinition) validateData(data map[string]string) (map[string]string, error) {
	allowed := map[string]bool{}
	result := map[string]string{}
	for _, f := range d.Fields {
		allowed[f.Name] = true
		value := strings.TrimSpace(data[f.Name])
		max := f.MaxLength
		if max == 0 {
			max = 2000
		}
		if f.Required && value == "" {
			return nil, fmt.Errorf("%s is required", f.Name)
		}
		if len([]rune(value)) > max {
			return nil, fmt.Errorf("%s is too long", f.Name)
		}
		if f.Type == "email" && value != "" && !validFormEmail(value) {
			return nil, fmt.Errorf("%s must be an email address", f.Name)
		}
		result[f.Name] = value
	}
	for key := range data {
		if !allowed[key] {
			return nil, fmt.Errorf("unknown field: %s", key)
		}
	}
	return result, nil
}

func readFormJSON(e *core.RequestEvent, target any) error {
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, 32768)
	decoder := json.NewDecoder(e.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return e.BadRequestError("Invalid JSON body (maximum 32 KB)", nil)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return e.BadRequestError("Expected a single JSON object", nil)
	}
	return nil
}

// Deliberately no localhost exemption: a public form must never grant admin
// access. Shares its authorization rule with plugin install/uninstall — see
// authorizeSiteAdmin in plugin_installations.go.
func authorizeForms(e *core.RequestEvent) (*core.Record, error) {
	return authorizeSiteAdmin(e)
}

func findForm(app core.App, site, slug string) (*core.Record, error) {
	return app.FindFirstRecordByFilter("primo_forms", "site = {:site} && slug = {:slug}", dbx.Params{"site": site, "slug": slug})
}

func formDefinition(record *core.Record) (FormDefinition, error) {
	var d FormDefinition
	err := record.UnmarshalJSONField("definition", &d)
	return d, err
}

// RegisterForms wires the forms plugin's routes. manifest is the raw bytes of
// plugins/forms/manifest.json (embedded in main.go, since go:embed can't
// reach outside internal/) — it's the single source of truth this package
// uses to decide which capabilities the plugin may request at install time.
func RegisterForms(pb *pocketbase.PocketBase, manifest []byte) error {
	formsManifestJSON = manifest
	if err := registerCurrentlyDeclaredCapabilities(formsPluginID, manifest); err != nil {
		return err
	}
	if err := RegisterPluginInstallations(pb); err != nil {
		return err
	}
	var jobs sync.Mutex
	pb.Cron().MustAdd("primo-form-notifications", "* * * * *", func() {
		if !jobs.TryLock() {
			return
		}
		defer jobs.Unlock()
		if err := deliverFormNotifications(pb, func(message *mailer.Message) error { return pb.NewMailClient().Send(message) }); err != nil {
			pb.Logger().Error("Form notification processing failed", "error", err)
		}
	})
	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/primo/runtime/forms.js", func(r *core.RequestEvent) error {
			content, err := formsAssets.ReadFile("forms-runtime.js")
			if err != nil {
				return err
			}
			r.Response.Header().Set("Content-Type", "text/javascript; charset=utf-8")
			r.Response.Header().Set("Cache-Control", "no-cache")
			_, err = r.Response.Write(content)
			return err
		})
		e.Router.PUT("/api/primo/sites/{siteId}/forms/{slug}", installForm)
		e.Router.GET("/api/primo/sites/{siteId}/forms", listForms)
		e.Router.GET("/api/primo/sites/{siteId}/forms/{slug}/submissions", listFormSubmissions)
		e.Router.POST("/api/primo/forms/{siteId}/{slug}/submit", submitForm)
		return e.Next()
	})
	return nil
}

func installForm(e *core.RequestEvent) error {
	site, err := authorizeForms(e)
	if err != nil {
		return err
	}
	slug := e.Request.PathValue("slug")
	if !formName.MatchString(slug) {
		return e.BadRequestError("Invalid form slug", nil)
	}
	dataGranted, err := pluginCapabilityGranted(e.App, site.Id, formsPluginID, "data")
	if err != nil {
		return err
	}
	if !dataGranted {
		return e.ForbiddenError("This site hasn't installed the forms plugin. PUT /api/primo/sites/"+site.Id+"/plugins/forms first.", nil)
	}
	var definition FormDefinition
	if err := readFormJSON(e, &definition); err != nil {
		return err
	}
	if err := definition.validate(); err != nil {
		return e.BadRequestError(err.Error(), nil)
	}
	if definition.NotifyTo != "" {
		emailGranted, err := pluginCapabilityGranted(e.App, site.Id, formsPluginID, "email")
		if err != nil {
			return err
		}
		if !emailGranted {
			return e.BadRequestError("This site hasn't granted the forms plugin the email capability. PUT /api/primo/sites/"+site.Id+"/plugins/forms with {\"grant\":{\"email\":true}} before setting notifyTo.", nil)
		}
	}
	record, err := findForm(e.App, site.Id, slug)
	if errors.Is(err, sql.ErrNoRows) {
		collection, err := e.App.FindCollectionByNameOrId("primo_forms")
		if err != nil {
			return err
		}
		record = core.NewRecord(collection)
		record.Set("site", site.Id)
		record.Set("slug", slug)
	} else if err != nil {
		return err
	}
	record.Set("definition", definition)
	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not save form", err)
	}
	return e.JSON(200, map[string]any{"slug": slug, "definition": definition, "emailConfigured": e.App.Settings().SMTP.Enabled})
}

func listForms(e *core.RequestEvent) error {
	e.Response.Header().Set("Cache-Control", "no-store")
	site, err := authorizeForms(e)
	if err != nil {
		return err
	}
	records, err := e.App.FindRecordsByFilter("primo_forms", "site = {:site}", "slug", 200, 0, dbx.Params{"site": site.Id})
	if err != nil {
		return err
	}
	items := []map[string]any{}
	for _, record := range records {
		definition, err := formDefinition(record)
		if err != nil {
			return err
		}
		items = append(items, map[string]any{"slug": record.GetString("slug"), "definition": definition})
	}
	return e.JSON(200, map[string]any{"items": items, "emailConfigured": e.App.Settings().SMTP.Enabled})
}

func listFormSubmissions(e *core.RequestEvent) error {
	site, err := authorizeForms(e)
	if err != nil {
		return err
	}
	form, err := findForm(e.App, site.Id, e.Request.PathValue("slug"))
	if err != nil {
		return e.NotFoundError("Form not found", nil)
	}
	page := 1
	if value := e.Request.URL.Query().Get("page"); value != "" {
		if _, err := fmt.Sscan(value, &page); err != nil || page < 1 || page > 100000 {
			return e.BadRequestError("Invalid page", nil)
		}
	}
	records, err := e.App.FindRecordsByFilter("primo_form_submissions", "form = {:form}", "-created,-id", 51, (page-1)*50, dbx.Params{"form": form.Id})
	if err != nil {
		return err
	}
	more := len(records) > 50
	if more {
		records = records[:50]
	}
	items := []map[string]any{}
	for _, record := range records {
		items = append(items, map[string]any{"id": record.Id, "data": record.Get("data"), "created": record.GetString("created"), "notification": record.GetString("notification"), "attempts": record.GetInt("attempts")})
	}
	e.Response.Header().Set("Cache-Control", "no-store")
	return e.JSON(200, map[string]any{"items": items, "page": page, "hasMore": more})
}

func submitForm(e *core.RequestEvent) error {
	form, err := findForm(e.App, e.Request.PathValue("siteId"), e.Request.PathValue("slug"))
	if err != nil {
		return e.NotFoundError("Form not found", nil)
	}
	definition, err := formDefinition(form)
	if err != nil {
		return err
	}
	if !definition.Enabled {
		return e.NotFoundError("Form not found", nil)
	}
	// Storage boundary: this site must currently have the forms plugin's
	// `data` capability granted. A never-installed or since-uninstalled
	// plugin must behave like "form not found" to an anonymous visitor —
	// never leak install state, and never accept the visitor's own siteId/
	// slug path as authority for anything beyond looking the form up.
	dataGranted, err := pluginCapabilityGranted(e.App, e.Request.PathValue("siteId"), formsPluginID, "data")
	if err != nil {
		return err
	}
	if !dataGranted {
		return e.NotFoundError("Form not found", nil)
	}
	var body struct {
		Data      map[string]string `json:"data"`
		RequestID string            `json:"requestId"`
		Website   string            `json:"website"` // Honeypot outside the declared schema.
	}
	if err := readFormJSON(e, &body); err != nil {
		return err
	}
	if body.Website != "" {
		return e.JSON(202, map[string]bool{"accepted": true})
	}
	if !formRequestKey.MatchString(body.RequestID) {
		return e.BadRequestError("A 16–80 character requestId is required", nil)
	}
	data, err := definition.validateData(body.Data)
	if err != nil {
		return e.BadRequestError(err.Error(), nil)
	}
	// Submission and pending notification are the same durable record. A retry cannot
	// enqueue another email. A reused key with different data is rejected.
	err = e.App.RunInTransaction(func(tx core.App) error {
		existing, err := tx.FindFirstRecordByFilter("primo_form_submissions", "form = {:form} && request_key = {:key}", dbx.Params{"form": form.Id, "key": body.RequestID})
		if err == nil {
			var old map[string]string
			if err := existing.UnmarshalJSONField("data", &old); err != nil {
				return err
			}
			a, _ := json.Marshal(old)
			b, _ := json.Marshal(data)
			if string(a) != string(b) {
				return e.BadRequestError("requestId already used for another submission", nil)
			}
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		collection, err := tx.FindCollectionByNameOrId("primo_form_submissions")
		if err != nil {
			return err
		}
		record := core.NewRecord(collection)
		record.Set("form", form.Id)
		record.Set("request_key", body.RequestID)
		record.Set("data", data)
		record.Set("notify_to", definition.NotifyTo)
		status := "off"
		if definition.NotifyTo != "" {
			status = "pending"
		}
		record.Set("notification", status)
		return tx.Save(record)
	})
	if err != nil {
		return err
	}
	return e.JSON(202, map[string]bool{"accepted": true})
}

// deliverFormNotificationsBatchSize is how many *authorized* jobs (email
// capability currently granted) a single cron tick attempts to send. Jobs
// skipped for a revoked grant don't count against it — see the scan loop
// below — so they can never crowd it out.
const deliverFormNotificationsBatchSize = 25

// deliverFormNotificationsScanLimit bounds total work per cron tick (DB rows
// read across every page) regardless of how many pending jobs are stuck
// behind a revoked grant, so a site that revokes email with a large backlog
// can't make a single tick run unbounded.
const deliverFormNotificationsScanLimit = 1000

// SMTP has no exactly-once guarantee: a crash after send but before Save can
// duplicate a notification. Submission storage itself is idempotent.
//
// Selection scans oldest-first in pages, skipping (without mutating) jobs
// whose site has since revoked the email capability, until it has attempted
// deliverFormNotificationsBatchSize authorized jobs or scanned
// deliverFormNotificationsScanLimit rows. Without this, a batch of revoked
// jobs sitting at the front of the queue would starve every authorized job
// behind them forever, since a plain LIMIT 25 always re-selects the same
// oldest rows on every tick.
func deliverFormNotifications(app core.App, send func(*mailer.Message) error) error {
	if !app.Settings().SMTP.Enabled {
		return nil
	}
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")
	attempted := 0
	scanned := 0
	const pageSize = 25
	for page := 0; attempted < deliverFormNotificationsBatchSize && scanned < deliverFormNotificationsScanLimit; page++ {
		records, err := app.FindRecordsByFilter("primo_form_submissions", "notification = 'pending' && (next_attempt = '' || next_attempt <= {:now})", "created", pageSize, page*pageSize, dbx.Params{"now": now})
		if err != nil {
			return err
		}
		if len(records) == 0 {
			break
		}
		for _, record := range records {
			if scanned >= deliverFormNotificationsScanLimit {
				break
			}
			scanned++
			// Notification (send) boundary: re-check the site's current email
			// grant on every delivery attempt, not just at submission time. A
			// capability revoked after a submission queued its notification must
			// block that queued job too — an undeclared/ungranted email
			// capability must prevent mail sending, full stop. Left pending
			// without touching attempts/next_attempt: this is an authorization
			// gate, not a transient SMTP failure, so it must not burn down the
			// retry budget and must resume on its own if the site re-grants
			// email. Not counted towards attempted: a large run of revoked jobs
			// must not be able to block authorized jobs further back in the
			// queue from ever being reached.
			form, err := app.FindRecordById("primo_forms", record.GetString("form"))
			if err != nil {
				return err
			}
			emailGranted, err := pluginCapabilityGranted(app, form.GetString("site"), formsPluginID, "email")
			if err != nil {
				return err
			}
			if !emailGranted {
				continue
			}
			if attempted >= deliverFormNotificationsBatchSize {
				continue
			}
			attempted++
			var data map[string]string
			if err := record.UnmarshalJSONField("data", &data); err != nil {
				return err
			}
			// JSON text avoids interpreting visitor-provided HTML or mail headers.
			content, err := json.MarshalIndent(data, "", "  ")
			if err != nil {
				return err
			}
			meta := app.Settings().Meta
			message := &mailer.Message{
				From:    mail.Address{Address: meta.SenderAddress, Name: meta.SenderName},
				To:      []mail.Address{{Address: record.GetString("notify_to")}},
				Subject: "New form submission", Text: string(content),
			}
			attempts := record.GetInt("attempts") + 1
			record.Set("attempts", attempts)
			if err := send(message); err != nil {
				if attempts >= 5 {
					record.Set("notification", "failed")
				}
				record.Set("next_attempt", time.Now().UTC().Add(time.Duration(1<<attempts)*time.Minute))
				app.Logger().Warn("Form notification failed", "submission", record.Id)
			} else {
				record.Set("notification", "sent")
			}
			if err := app.Save(record); err != nil {
				return err
			}
		}
		if len(records) < pageSize {
			break
		}
	}
	return nil
}
