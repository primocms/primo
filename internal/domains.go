package internal

import (
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase"
)

// Base domain for auto-assigned site subdomains. When set (e.g.
// "acme.primo.page" on hosted, or a base pointed at a self-hosted box via
// "*.someagency.com"), a newly created site is auto-assigned a live host of the
// form "<slug>.<base>" instead of the editor-only `host === id` sentinel.
// Serving is unchanged — serve.go matches whatever host we store — so the only
// external requirement is that the operator has pointed the wildcard at this
// server and has a wildcard TLS cert. That setup is done once, outside Primo.
//
// Empty means "no base domain": new sites stay unassigned (host === id) and are
// editor-only until a domain is assigned. This is the default self-host path.
func baseDomain() string {
	return strings.Trim(strings.TrimSpace(os.Getenv("PRIMO_BASE_DOMAIN")), ".")
}

var (
	slugNonAlnum   = regexp.MustCompile(`[^a-z0-9]+`)
	slugTrimHyphen = regexp.MustCompile(`^-+|-+$`)
)

// slugifyHost turns a site name into a DNS-label-safe slug: lowercase, ascii
// alphanumerics and single hyphens, no leading/trailing hyphen, capped at 63
// chars (the max length of a single DNS label). Falls back to "site" when the
// name has no usable characters (e.g. all emoji/punctuation).
func slugifyHost(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = slugNonAlnum.ReplaceAllString(s, "-")
	s = slugTrimHyphen.ReplaceAllString(s, "")
	if len(s) > 63 {
		s = strings.Trim(s[:63], "-")
	}
	if s == "" {
		return "site"
	}
	return s
}

// assignSubdomain picks a unique "<slug>.<base>" host for a new site. If the
// bare slug is taken it appends "-2", "-3", … until it finds a free host. A
// concurrent create racing on the same slug is caught by the sites collection's
// UNIQUE(host) constraint (the losing save fails and can retry); this loop just
// avoids the common non-concurrent collision.
func assignSubdomain(pb *pocketbase.PocketBase, name, base string) string {
	slug := slugifyHost(name)
	candidate := slug + "." + base
	for i := 2; ; i++ {
		existing, _ := pb.FindFirstRecordByData("sites", "host", candidate)
		if existing == nil {
			return candidate
		}
		candidate = slug + "-" + strconv.Itoa(i) + "." + base
	}
}

// resolveNewSiteHost decides the host for a freshly created site when the
// caller did not supply one. With a base domain configured it returns a live
// "<slug>.<base>" subdomain; otherwise it returns "" to signal the caller
// should fall back to the unassigned sentinel (host === id).
func resolveNewSiteHost(pb *pocketbase.PocketBase, name string) string {
	base := baseDomain()
	if base == "" {
		return ""
	}
	return assignSubdomain(pb, name, base)
}

// isSubdomainOfBase reports whether host sits under the configured base domain
// (i.e. was auto-assigned, or is otherwise covered by the wildcard cert). Used
// later by the domain-connect flow to know a host needs no platform work.
func isSubdomainOfBase(host string) bool {
	base := baseDomain()
	if base == "" {
		return false
	}
	return host == base || strings.HasSuffix(host, "."+base)
}
