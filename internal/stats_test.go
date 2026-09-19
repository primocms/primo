package internal

import "testing"

// TestUsageStatsSelfHostedOptIn guards the "transparent and opt-in" contract
// for self-hosted instances: without PRIMO_HOSTED_MODE, usage stats must stay
// off unless the operator explicitly sets PRIMO_ENABLE_USAGE_STATS=true.
func TestUsageStatsSelfHostedOptIn(t *testing.T) {
	t.Setenv("PRIMO_HOSTED_MODE", "")
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "")
	if got := isUsageStateEnabled(); got {
		t.Errorf("self-hosted with no override: got enabled=%v, want false (opt-in only)", got)
	}

	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "true")
	if got := isUsageStateEnabled(); !got {
		t.Errorf("self-hosted with PRIMO_ENABLE_USAGE_STATS=true: got enabled=%v, want true", got)
	}

	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "false")
	if got := isUsageStateEnabled(); got {
		t.Errorf("self-hosted with PRIMO_ENABLE_USAGE_STATS=false: got enabled=%v, want false", got)
	}
}

// TestUsageStatsHostedDefaultOn guards the hosted-mode default: Primo's own
// managed instances report by default, but an operator override still wins
// either direction.
func TestUsageStatsHostedDefaultOn(t *testing.T) {
	t.Setenv("PRIMO_HOSTED_MODE", "true")
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "")
	if got := isUsageStateEnabled(); !got {
		t.Errorf("hosted mode with no override: got enabled=%v, want true (default on)", got)
	}

	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "false")
	if got := isUsageStateEnabled(); got {
		t.Errorf("hosted mode with PRIMO_ENABLE_USAGE_STATS=false: got enabled=%v, want false (explicit opt-out)", got)
	}
}

// TestInfoEndpointTelemetryMatchesUsageStats guards against the two fields
// drifting apart again the way TelemetryEnabled did (hardcoded false while
// stats.go still read an env var) before this fix.
func TestInfoEndpointTelemetryMatchesUsageStats(t *testing.T) {
	t.Setenv("PRIMO_HOSTED_MODE", "true")
	t.Setenv("PRIMO_ENABLE_USAGE_STATS", "")
	if got := isUsageStateEnabled(); got != isHostedMode() {
		t.Fatalf("isUsageStateEnabled()=%v should track isHostedMode()=%v when no override is set", got, isHostedMode())
	}
}
