package internal

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// Rate limiting is a login brute-force floor. The editor bursts one create per
// field value, so the default *:create / batch / API-wide rules must not apply
// to signed-in users, while *:auth still applies to everyone.
func TestRateLimitsScopeEditorTrafficToGuests(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	limits := app.Settings().RateLimits
	if !limits.Enabled {
		t.Fatal("rate limiting should be enabled")
	}
	want := map[string]string{
		"*:auth":     core.RateLimitRuleAudienceAll,
		"*:create":   core.RateLimitRuleAudienceGuest,
		"/api/batch": core.RateLimitRuleAudienceGuest,
		"/api/":      core.RateLimitRuleAudienceGuest,
	}
	for _, rule := range limits.Rules {
		if audience, ok := want[rule.Label]; ok {
			if rule.Audience != audience {
				t.Errorf("rule %q audience = %q, want %q", rule.Label, rule.Audience, audience)
			}
			delete(want, rule.Label)
		}
	}
	for label := range want {
		t.Errorf("rule %q missing", label)
	}
}
