package internal

import (
	"os"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// Check if running in hosted mode (managed SaaS)
func isHostedMode() bool {
	return os.Getenv("PRIMO_HOSTED_MODE") == "true"
}

var buildTime string
var buildVersion string

// Get build time
func getBuildTime() (time.Time, error) {
	if buildTime == "" {
		return time.Now(), nil
	}

	return time.Parse(time.RFC3339, buildTime)
}

// Get version
func getBuildVersion() string {
	if buildVersion == "" {
		return "dev"
	}
	return buildVersion
}

// Get or create unique instance ID
func getInstanceId(pb *pocketbase.PocketBase) (string, error) {
	collection, err := pb.FindCollectionByNameOrId("config_values")
	if err != nil {
		return "", err
	}

	var instanceId string
	record, err := pb.FindFirstRecordByData(collection.Id, "key", "instance_id")
	if err != nil {
		// ID not found, let's create it
		instanceId = security.RandomString(20)
		record = core.NewRecord(collection)
		record.Set("key", "instance_id")
		record.Set("value", instanceId)
		if err := pb.Save(record); err != nil {
			return "", err
		}
	} else {
		instanceId = record.GetString("value")
		if instanceId == "" {
			// Empty ID, let's fill it
			instanceId = security.RandomString(20)
			record.Set("value", instanceId)
			if err := pb.Save(record); err != nil {
				return "", err
			}
		}
	}

	return instanceId, nil
}

func RegisterVersion(pb *pocketbase.PocketBase) error {
	pb.RootCmd.Version = getBuildVersion()
	return nil
}

func RegisterInfoEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/primo/info", func(requestEvent *core.RequestEvent) error {
			id, err := getInstanceId(pb)
			if err != nil {
				return err
			}

			version := getBuildVersion()
			telemetryEnabled := isUsageStateEnabled()
			smtpEnabled := pb.Settings().SMTP.Enabled

			// Expose plan caps so the UI can disable the create-site / add-editor
			// affordances and show usage. A cap of 0 means unlimited (omitted).
			// site_count is instance-wide (site cap is instance-wide); the editor
			// cap is per-site, so the per-site count is computed client-side from
			// that site's role assignments rather than surfaced here.
			siteCap := getCap(pb, "site_cap", "PRIMO_SITE_CAP")
			editorCap := getCap(pb, "editor_cap", "PRIMO_EDITOR_CAP")
			siteCount, _ := pb.CountRecords("sites")
			// library_block_count lets the setup screen show what a fresh
			// `primo deploy` just seeded ("1 site · 12 library blocks loaded")
			// before the operator creates their account.
			libraryBlockCount, _ := pb.CountRecords("library_symbols")

			return requestEvent.JSON(200, struct {
				Id                string `json:"id"`
				Version           string `json:"version"`
				TelemetryEnabled  bool   `json:"telemetry_enabled"`
				SMTPEnabled       bool   `json:"smtp_enabled"`
				HostedMode        bool   `json:"hosted_mode"`
				ManagedBootstrap  bool   `json:"managed_bootstrap"`
				OwnerOnly         bool   `json:"owner_only"`
				BillingURL        string `json:"billing_url,omitempty"`
				DevMode           bool   `json:"dev_mode"`
				SiteCap           int    `json:"site_cap,omitempty"`
				SiteCount         int64  `json:"site_count"`
				LibraryBlockCount int64  `json:"library_block_count"`
				EditorCap         int    `json:"editor_cap,omitempty"`
				// Domain provider + base domain let the editor pick the
				// connect-domain flow: "railway" and "fly" attach and poll,
				// while "manual" shows generic DNS guidance. base_domain (if
				// set) gives new sites a live subdomain and is shown as a hint.
				DomainProvider      string   `json:"domain_provider"`
				DomainProviderReady bool     `json:"domain_provider_ready"`
				Capabilities        []string `json:"capabilities"`
				BaseDomain          string   `json:"base_domain,omitempty"`
			}{
				Id:                  id,
				Version:             version,
				TelemetryEnabled:    telemetryEnabled,
				SMTPEnabled:         smtpEnabled,
				HostedMode:          isHostedMode(),
				ManagedBootstrap:    os.Getenv("PRIMO_MANAGED_BOOTSTRAP") == "true",
				BillingURL:          os.Getenv("PRIMO_BILLING_URL"),
				DevMode:             DevMode,
				SiteCap:             siteCap,
				SiteCount:           siteCount,
				LibraryBlockCount:   libraryBlockCount,
				EditorCap:           editorCap,
				OwnerOnly:           ownerOnly(pb),
				DomainProvider:      getDomainProvider().Name(),
				DomainProviderReady: domainProviderReady(getDomainProvider()),
				Capabilities:        []string{"agent_launch_v1", "cli_browser_login", "domains", "import_chunks_v1"},
				BaseDomain:          baseDomain(),
			})
		})

		return serveEvent.Next()
	})

	return nil
}
