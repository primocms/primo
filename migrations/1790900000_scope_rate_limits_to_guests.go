package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 1787000000_enable_rate_limits turned on PocketBase's rate limiter for a
// login brute-force floor and kept the default rules. Those defaults also
// apply to signed-in users: *:create allows 20 creates per 5s per IP, and the
// editor creates one record per field value, so copying a single block (the
// Create Site wizard, adding a section) hit 429s and left the editor half
// done. Scope the non-auth defaults to guests; *:auth still applies to
// everyone. Rules an admin has changed from the defaults are left alone.
func init() {
	isDefault := func(r core.RateLimitRule) bool {
		switch r.Label {
		case "*:create":
			return r.Duration == 5 && r.MaxRequests == 20
		case "/api/batch":
			return r.Duration == 1 && r.MaxRequests == 3
		case "/api/":
			return r.Duration == 10 && r.MaxRequests == 300
		}
		return false
	}
	m.Register(
		func(app core.App) error {
			settings := app.Settings()
			changed := false
			for i, rule := range settings.RateLimits.Rules {
				if rule.Audience == core.RateLimitRuleAudienceAll && isDefault(rule) {
					settings.RateLimits.Rules[i].Audience = core.RateLimitRuleAudienceGuest
					changed = true
				}
			}
			if !changed {
				return nil
			}
			return app.Save(settings)
		},
		// Irreversible on purpose: by the time this would run, an admin may have
		// added separate @auth rules next to these, and turning a @guest rule
		// back into an all-users one would conflict with them (PocketBase
		// rejects overlapping rules), failing the rollback. The previous
		// behaviour is restored, if wanted, from the admin UI.
		func(app core.App) error { return nil },
	)
}
