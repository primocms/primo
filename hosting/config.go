// Package hosting runs the hosted signup control plane, separately from customer servers.
package hosting

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/mail"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Plan struct {
	Name      string `json:"name"`
	Sites     int    `json:"sites"`
	Editors   int    `json:"editors"`
	OwnerOnly bool   `json:"owner_only,omitempty"`
}

type Config struct {
	PublicURL, Database, Domain, FlyOrg, Region, Image, FlyToken, FlyCLI string
	CloudflareToken, CloudflareZone, WebhookSecret, WebhookScheme        string
	ResendToken, FromEmail, BillingURL, OpsToken, AlertEmail             string
	SMTPManagementToken, SMTPDomainID                                    string
	Key                                                                  []byte
	Products                                                             map[string]Plan
	Cutover                                                              time.Time
	DNSLimit                                                             int
	Backups                                                              BackupConfig
	MonitorToken                                                         string
}

func ConfigFromEnv() (Config, error) {
	c := Config{
		PublicURL: os.Getenv("HOSTING_PUBLIC_URL"), Database: os.Getenv("HOSTING_DATABASE"),
		Domain: os.Getenv("HOSTING_DOMAIN"), FlyOrg: os.Getenv("HOSTING_FLY_ORG"), Region: os.Getenv("HOSTING_REGION"),
		Image: os.Getenv("HOSTING_CUSTOMER_IMAGE"), FlyToken: os.Getenv("FLY_API_TOKEN"), FlyCLI: os.Getenv("HOSTING_FLY_CLI"),
		CloudflareToken: os.Getenv("CLOUDFLARE_API_TOKEN"), CloudflareZone: os.Getenv("CLOUDFLARE_ZONE_ID"),
		WebhookSecret: os.Getenv("POLAR_WEBHOOK_SECRET"), WebhookScheme: os.Getenv("POLAR_WEBHOOK_SCHEME"),
		SMTPManagementToken: os.Getenv("HOSTING_SMTP_MANAGEMENT_TOKEN"), SMTPDomainID: os.Getenv("HOSTING_SMTP_DOMAIN_ID"),
		ResendToken: os.Getenv("RESEND_API_KEY"), FromEmail: os.Getenv("HOSTING_FROM_EMAIL"),
		BillingURL: os.Getenv("HOSTING_BILLING_URL"), OpsToken: os.Getenv("HOSTING_OPS_TOKEN"),
		AlertEmail:   os.Getenv("HOSTING_ALERT_EMAIL"),
		MonitorToken: os.Getenv("HOSTING_MONITOR_TOKEN"),
		Backups:      BackupConfig{Enabled: os.Getenv("HOSTING_BACKUPS_ENABLED") == "true", Bucket: os.Getenv("HOSTING_R2_BUCKET"), Region: os.Getenv("HOSTING_R2_REGION"), Endpoint: os.Getenv("HOSTING_R2_ENDPOINT"), AccessKey: os.Getenv("HOSTING_R2_ACCESS_KEY"), Secret: os.Getenv("HOSTING_R2_SECRET_KEY"), Recipient: os.Getenv("HOSTING_BACKUP_RECIPIENT")},
	}
	if (c.SMTPManagementToken == "") != (c.SMTPDomainID == "") {
		return c, errors.New("hosted SMTP requires both management token and domain ID")
	}
	if c.SMTPManagementToken != "" {
		sender, err := mail.ParseAddress(c.FromEmail)
		if err != nil || !strings.HasSuffix(sender.Address, "@email.primo.build") || c.SMTPManagementToken == c.ResendToken {
			return c, errors.New("hosted SMTP requires a separate management token and email.primo.build sender")
		}
	}
	if c.Database == "" {
		c.Database = "/data/hosting.sqlite"
	}
	if c.Domain == "" {
		c.Domain = "primo.page"
	}
	if c.Region == "" {
		c.Region = "iad"
	}
	if c.FlyCLI == "" {
		c.FlyCLI = "flyctl"
	}
	if c.WebhookScheme == "" {
		c.WebhookScheme = "standard"
	}
	c.DNSLimit = 200
	if raw := os.Getenv("HOSTING_DNS_RECORD_LIMIT"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 4 {
			return c, errors.New("invalid HOSTING_DNS_RECORD_LIMIT")
		}
		c.DNSLimit = value
	}
	var err error
	c.Key, err = base64.StdEncoding.DecodeString(os.Getenv("HOSTING_ENCRYPTION_KEY"))
	if err != nil || len(c.Key) != 32 {
		return c, errors.New("HOSTING_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
	}
	c.Cutover, err = time.Parse(time.RFC3339, os.Getenv("HOSTING_CUTOVER_AT"))
	if err != nil {
		return c, errors.New("HOSTING_CUTOVER_AT must be an explicit RFC3339 launch time")
	}
	if err = json.Unmarshal([]byte(os.Getenv("HOSTING_PRODUCTS")), &c.Products); err != nil || len(c.Products) == 0 {
		return c, errors.New("HOSTING_PRODUCTS must map Polar product IDs to plan caps")
	}
	for id, plan := range c.Products {
		if id == "" || plan.Name == "" || plan.Sites <= 0 || plan.Editors < 0 || (plan.OwnerOnly && plan.Editors != 0) || (plan.Name == "Maker" && !plan.OwnerOnly) {
			return c, errors.New("invalid automated plan; Agency stays manual")
		}
	}
	for _, value := range []string{c.PublicURL, c.FlyOrg, c.FlyToken, c.CloudflareToken, c.CloudflareZone, c.WebhookSecret, c.ResendToken, c.FromEmail, c.BillingURL, c.AlertEmail} {
		if strings.TrimSpace(value) == "" {
			return c, errors.New("missing required hosting configuration; see deploy/fly/hosting/README.md")
		}
	}
	for _, raw := range []string{c.PublicURL, c.BillingURL} {
		u, err := url.Parse(raw)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, errors.New("hosting and billing URLs must be plain HTTPS URLs")
		}
	}
	if strings.TrimSuffix(c.PublicURL, "/") != c.PublicURL {
		return c, errors.New("HOSTING_PUBLIC_URL must not end in a slash")
	}
	if c.Domain != "primo.page" || c.FlyOrg != "primo-hosted" {
		return c, errors.New("this provisioner is restricted to primo.page in primo-hosted")
	}
	if !strings.Contains(c.Image, "@sha256:") {
		return c, errors.New("HOSTING_CUSTOMER_IMAGE must pin the tested image by digest")
	}
	if c.WebhookScheme != "standard" && c.WebhookScheme != "legacy" {
		return c, errors.New("unknown POLAR_WEBHOOK_SCHEME")
	}
	if len(c.OpsToken) < 32 {
		return c, errors.New("HOSTING_OPS_TOKEN must contain at least 32 characters")
	}
	if c.MonitorToken != "" && (len(c.MonitorToken) < 32 || c.MonitorToken == c.OpsToken) {
		return c, errors.New("HOSTING_MONITOR_TOKEN must be a separate read-only key of at least 32 characters")
	}
	if err := c.Backups.Validate(); err != nil {
		return c, err
	}
	return c, nil
}
