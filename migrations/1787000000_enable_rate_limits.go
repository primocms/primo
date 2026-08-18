package migrations

import (
	"os"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Enable PocketBase's built-in IP rate limiter so the login endpoint has a
// brute-force floor — Railway puts no WAF in front of us, so nothing else
// throttles repeated auth-with-password attempts. PocketBase's default rules
// already cover login (the *:auth rule is 2 req/3s), so we only flip the
// Enabled toggle and leave Rules untouched.
//
// This is a dedicated migration (its own filename = its own identity) rather
// than folding the change into 1757326540_settings.go: that migration reuses
// the identity "1754640604_settings.js", which every existing install —
// including prod and already-provisioned customers — recorded ~11 months ago,
// so PocketBase would skip it and they'd never get rate limiting. A new
// identity runs exactly once on fresh AND existing installs.
//
// Both states are assigned explicitly so the value tracks the env: set
// PRIMO_RATE_LIMIT=off to disable (for self-hosters behind their own
// proxy/WAF), and toggling it back on a later boot is a no-op here since the
// migration only runs once — the admin UI remains the live control after that.
func init() {
	m.Register(
		func(app core.App) error {
			settings := app.Settings()
			settings.RateLimits.Enabled = os.Getenv("PRIMO_RATE_LIMIT") != "off"
			return app.Save(settings)
		},
		func(app core.App) error {
			settings := app.Settings()
			settings.RateLimits.Enabled = false
			return app.Save(settings)
		},
	)
}
