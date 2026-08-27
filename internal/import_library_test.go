package internal

import (
	"errors"
	"testing"
)

// The import-library auth gate is security-sensitive: it opens an
// unauthenticated write path, so its exact conditions are pinned here. The
// gate must (a) always let authed/localhost callers through, (b) allow an
// unauthenticated remote caller ONLY on a fresh (zero-site) server, and
// (c) fail closed when the site lookup errors.
func TestLibraryImportAuthDecision(t *testing.T) {
	lookupErr := errors.New("db down")

	cases := []struct {
		name       string
		authed     bool
		isLocal    bool
		siteCount  int
		lookupErr  error
		wantReject string
		wantFresh  bool
	}{
		{
			name:   "authed remote passes without lookup",
			authed: true,
		},
		{
			name:    "localhost passes without lookup",
			isLocal: true,
		},
		{
			name:      "authed still passes even with sites present",
			authed:    true,
			siteCount: 5,
		},
		{
			name:      "unauthenticated remote on fresh server is allowed and additive",
			siteCount: 0,
			wantFresh: true,
		},
		{
			name:       "unauthenticated remote with sites is rejected",
			siteCount:  1,
			wantReject: "unauthorized",
		},
		{
			name:       "lookup error fails closed for unauthenticated remote",
			lookupErr:  lookupErr,
			wantReject: "internal",
		},
		{
			name:       "lookup error takes precedence over a zero count",
			siteCount:  0,
			lookupErr:  lookupErr,
			wantReject: "internal",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := libraryImportAuthDecision(tc.authed, tc.isLocal, tc.siteCount, tc.lookupErr)
			if got.reject != tc.wantReject {
				t.Errorf("reject = %q, want %q", got.reject, tc.wantReject)
			}
			if got.freshServer != tc.wantFresh {
				t.Errorf("freshServer = %v, want %v", got.freshServer, tc.wantFresh)
			}
			// A rejected request must never be marked fresh (would imply an
			// additive seed on a denied path).
			if got.reject != "" && got.freshServer {
				t.Errorf("rejected decision marked freshServer")
			}
		})
	}
}
