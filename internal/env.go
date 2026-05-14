package internal

import "os"

// getenvCompat reads the primary env var; if it's unset, it falls back to the
// legacy name. Used during the Pala→Primo rename so existing deployments
// that set PALA_* keep working while new deployments can use PRIMO_*.
// The legacy fallback is intended to be removed in a future major release.
func getenvCompat(primary, legacy string) string {
	if v := os.Getenv(primary); v != "" {
		return v
	}
	return os.Getenv(legacy)
}
