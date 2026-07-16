package internal

import "testing"

func TestSlugifyHost(t *testing.T) {
	cases := map[string]string{
		"My Portfolio":      "my-portfolio",
		"  spaced  out  ":   "spaced-out",
		"UPPER Case":        "upper-case",
		"weird__chars!!":    "weird-chars",
		"--leading-trail--": "leading-trail",
		"café résumé":       "caf-r-sum", // non-ascii dropped, collapsed
		"":                  "site",
		"!!!":               "site",
		"a.b.c":             "a-b-c",
	}
	for in, want := range cases {
		if got := slugifyHost(in); got != want {
			t.Errorf("slugifyHost(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSlugifyHostCapsAt63(t *testing.T) {
	long := ""
	for i := 0; i < 100; i++ {
		long += "a"
	}
	got := slugifyHost(long)
	if len(got) != 63 {
		t.Errorf("slugifyHost long label len = %d, want 63", len(got))
	}
}

func TestIsSubdomainOfBase(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "acme.primo.page")
	cases := map[string]bool{
		"acme.primo.page":          true,
		"foo.acme.primo.page":      true,
		"a.b.acme.primo.page":      true,
		"acme.primo.page.evil.com": false,
		"notacme.primo.page":       false, // suffix match must be on a dot boundary
		"primo.page":               false,
		"other.com":                false,
	}
	for host, want := range cases {
		if got := isSubdomainOfBase(host); got != want {
			t.Errorf("isSubdomainOfBase(%q) = %v, want %v", host, got, want)
		}
	}
}

func TestBaseDomainTrimsDots(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", ".acme.primo.page.")
	if got := baseDomain(); got != "acme.primo.page" {
		t.Errorf("baseDomain() = %q, want %q", got, "acme.primo.page")
	}
}

func TestNoBaseDomainMeansEmpty(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "")
	if got := baseDomain(); got != "" {
		t.Errorf("baseDomain() = %q, want empty", got)
	}
	if isSubdomainOfBase("anything.com") {
		t.Error("isSubdomainOfBase should be false with no base domain")
	}
}
