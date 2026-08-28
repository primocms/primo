package internal

import (
	"errors"
	"testing"
)

// The import-library auth gate is security-sensitive: it opens an
// unauthenticated write path, so its exact conditions are pinned here. The
// gate must (a) always let authed/localhost callers through, (b) allow an
// unauthenticated remote caller ONLY on a fresh server — zero sites AND an
// empty library, so the path is genuinely create-only — and (c) fail closed
// when a lookup errors.
func TestLibraryImportAuthDecision(t *testing.T) {
	lookupErr := errors.New("db down")

	cases := []struct {
		name         string
		authed       bool
		isLocal      bool
		siteCount    int
		libraryCount int
		lookupErr    error
		wantReject   string
		wantFresh    bool
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
			name:         "authed still passes even with sites and library present",
			authed:       true,
			siteCount:    5,
			libraryCount: 12,
		},
		{
			name: "unauthenticated remote on fully fresh server is allowed and create-only",
			// zero sites, empty library
			wantFresh: true,
		},
		{
			name:       "unauthenticated remote with sites is rejected",
			siteCount:  1,
			wantReject: "unauthorized",
		},
		{
			name:         "unauthenticated remote with an existing library is rejected even at zero sites",
			libraryCount: 1,
			wantReject:   "unauthorized",
		},
		{
			name:       "site lookup error fails closed",
			lookupErr:  lookupErr,
			wantReject: "internal",
		},
		{
			name:         "lookup error takes precedence over zero counts",
			siteCount:    0,
			libraryCount: 0,
			lookupErr:    lookupErr,
			wantReject:   "internal",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := libraryImportAuthDecision(tc.authed, tc.isLocal, tc.siteCount, tc.libraryCount, tc.lookupErr)
			if got.reject != tc.wantReject {
				t.Errorf("reject = %q, want %q", got.reject, tc.wantReject)
			}
			if got.freshServer != tc.wantFresh {
				t.Errorf("freshServer = %v, want %v", got.freshServer, tc.wantFresh)
			}
			// A rejected request must never be marked fresh (would imply a
			// create-only seed on a denied path).
			if got.reject != "" && got.freshServer {
				t.Errorf("rejected decision marked freshServer")
			}
			// A fresh decision must be strictly create-only: zero sites AND
			// empty library.
			if got.freshServer && (tc.siteCount > 0 || tc.libraryCount > 0) {
				t.Errorf("freshServer granted with siteCount=%d libraryCount=%d", tc.siteCount, tc.libraryCount)
			}
		})
	}
}
