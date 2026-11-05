package hosting

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestConfigRejectsInvalidAlertEmailBeforeProvisioning(t *testing.T) {
	// No credentials, provider requests or production environment are needed.
	for _, name := range []string{"HOSTING_SMTP_MANAGEMENT_TOKEN", "HOSTING_SMTP_DOMAIN_ID", "HOSTING_MONITOR_TOKEN", "HOSTING_DNS_RECORD_LIMIT", "HOSTING_BACKUPS_ENABLED", "HOSTING_WEBHOOK_SCHEME", "POLAR_WEBHOOK_SCHEME"} {
		t.Setenv(name, "")
	}
	for name, value := range map[string]string{
		"HOSTING_PUBLIC_URL": "https://hosting.primo.page", "HOSTING_FLY_ORG": "primo-hosted",
		"HOSTING_DOMAIN": "primo.page", "FLY_API_TOKEN": "test-fly", "CLOUDFLARE_API_TOKEN": "test-cf",
		"CLOUDFLARE_ZONE_ID": "test-zone", "POLAR_WEBHOOK_SECRET": "test-webhook", "RESEND_API_KEY": "test-send",
		"HOSTING_FROM_EMAIL": "Primo <hello@email.primo.build>", "HOSTING_BILLING_URL": "https://billing.example.com",
		"HOSTING_ENCRYPTION_KEY": base64.StdEncoding.EncodeToString(make([]byte, 32)),
		"HOSTING_CUTOVER_AT":     "2026-11-04T00:00:00Z", "HOSTING_OPS_TOKEN": strings.Repeat("x", 32),
		"HOSTING_PRODUCTS":       `{"solo":{"name":"Solo","sites":1,"editors":1}}`,
		"HOSTING_CUSTOMER_IMAGE": "example.com/customer@sha256:" + strings.Repeat("a", 64),
	} {
		t.Setenv(name, value)
	}
	for _, address := range []string{"operator@example.com", "Operator <operator@example.com>"} {
		t.Setenv("HOSTING_ALERT_EMAIL", address)
		if _, err := ConfigFromEnv(); err != nil {
			t.Fatalf("valid alert address rejected: %v", err)
		}
	}
	for _, address := range []string{"invalid", "ops@example.com, other@example.com", "Operator\n<ops@example.com>"} {
		t.Setenv("HOSTING_ALERT_EMAIL", address)
		if _, err := ConfigFromEnv(); err == nil || err.Error() != "HOSTING_ALERT_EMAIL must be a valid email address" {
			t.Fatalf("invalid alert address was not rejected at startup: %v", err)
		}
	}
}
