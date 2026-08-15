package internal

import (
	"strings"
	"testing"
)

// TestApplyDomainResultPreservesProviderID guards the self-poisoning bug: a
// status poll that returns a zero-value result (empty ProviderID) must not wipe
// the previously-stored provider id, otherwise every later poll trips the
// empty-id guard and the domain is stuck forever.
func TestApplyDomainResultPreservesProviderID(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)

	// Initial attach stamps a real provider id.
	if err := applyDomainResult(app, site, "example.com", DomainResult{ProviderID: "cd_real", Status: DomainStatusVerifying}); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	if got := site.GetString("domain_provider_id"); got != "cd_real" {
		t.Fatalf("provider id = %q, want cd_real", got)
	}

	// A poll returns an empty-id result (e.g. Railway customDomain went null).
	if err := applyDomainResult(app, site, "example.com", DomainResult{ProviderID: "", Status: DomainStatusPending}); err != nil {
		t.Fatalf("second apply: %v", err)
	}
	if got := site.GetString("domain_provider_id"); got != "cd_real" {
		t.Errorf("provider id was clobbered to %q, want preserved cd_real", got)
	}

	// A real new id still advances.
	if err := applyDomainResult(app, site, "example.com", DomainResult{ProviderID: "cd_new", Status: DomainStatusLive}); err != nil {
		t.Fatalf("third apply: %v", err)
	}
	if got := site.GetString("domain_provider_id"); got != "cd_new" {
		t.Errorf("provider id = %q, want cd_new", got)
	}
}

// TestApplyDomainResultTruncatesError ensures a verbose provider error can't
// exceed the domain_error column max and fail the save.
func TestApplyDomainResultTruncatesError(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)

	long := strings.Repeat("x", domainErrorMax+250)
	if err := applyDomainResult(app, site, "example.com", DomainResult{Status: DomainStatusError, Error: long}); err != nil {
		t.Fatalf("apply with long error should not fail the save: %v", err)
	}
	if got := len(site.GetString("domain_error")); got != domainErrorMax {
		t.Errorf("stored error len = %d, want %d", got, domainErrorMax)
	}
}

// TestManualProviderStatusKeepsRecords guards that a manual-provider status
// check keeps the routing record (so the CNAME guidance isn't erased) even
// though it reports the domain live.
func TestManualProviderStatusKeepsRecords(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "acme.primo.page")
	p := manualProvider{}

	res, err := p.DomainStatus("", "theirbrand.com")
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != DomainStatusLive {
		t.Errorf("status = %q, want live", res.Status)
	}
	if len(res.Records) != 1 || res.Records[0].Type != "CNAME" {
		t.Errorf("expected the routing CNAME to survive, got %+v", res.Records)
	}
}

func TestLabelWithSuffix(t *testing.T) {
	cases := []struct{ slug, suffix, want string }{
		{"short", "-2", "short-2"},
		{strings.Repeat("a", 63), "-2", strings.Repeat("a", 61) + "-2"}, // suffix survives, total 63
		{strings.Repeat("a", 63), "-abc123", strings.Repeat("a", 56) + "-abc123"},
	}
	for _, c := range cases {
		got := labelWithSuffix(c.slug, c.suffix)
		if got != c.want {
			t.Errorf("labelWithSuffix(%d-char slug, %q) = %q (len %d), want %q", len(c.slug), c.suffix, got, len(got), c.want)
		}
		if len(got) > 63 {
			t.Errorf("result %q exceeds 63 chars (%d)", got, len(got))
		}
	}
}

func TestToDomainResultStatus(t *testing.T) {
	// mk builds a domain with `n` DNS records (each with the given per-record
	// enum) and a cert status. Overall status is driven by certStatus.
	mk := func(certStatus string, verified bool, dnsStatuses ...string) railwayCustomDomain {
		cd := railwayCustomDomain{ID: "cd_1", Domain: "example.com"}
		cd.Status.CertificateStatus = certStatus
		cd.Status.Verified = verified
		for _, s := range dnsStatuses {
			rec := struct {
				Hostlabel     string `json:"hostlabel"`
				Fqdn          string `json:"fqdn"`
				RecordType    string `json:"recordType"`
				RequiredValue string `json:"requiredValue"`
				CurrentValue  string `json:"currentValue"`
				Status        string `json:"status"`
				Purpose       string `json:"purpose"`
			}{Fqdn: "example.com", RecordType: "CNAME", RequiredValue: "target.railway.app", Status: s, Purpose: "routing"}
			cd.Status.DNSRecords = append(cd.Status.DNSRecords, rec)
		}
		return cd
	}

	cases := []struct {
		name     string
		cd       railwayCustomDomain
		wantStat string
		wantRecs int
	}{
		{"no records, no cert = pending", mk("", false), DomainStatusPending, 0},
		{"cert valid = live", mk(railwayCertValid, true, railwayDNSPropagated), DomainStatusLive, 1},
		{"records but cert issuing = verifying", mk("CERTIFICATE_STATUS_TYPE_ISSUING", false, railwayDNSPropagated), DomainStatusVerifying, 1},
		{"cert issue failed = error", mk(railwayCertIssueFail, false, railwayDNSPropagated), DomainStatusError, 1},
		{"verified but no records/cert = verifying", mk("", true), DomainStatusVerifying, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := toDomainResult(c.cd)
			if got.Status != c.wantStat {
				t.Errorf("status = %q, want %q", got.Status, c.wantStat)
			}
			if len(got.Records) != c.wantRecs {
				t.Errorf("records = %d, want %d", len(got.Records), c.wantRecs)
			}
			if got.ProviderID != "cd_1" {
				t.Errorf("providerID = %q, want cd_1", got.ProviderID)
			}
		})
	}

	// Per-record status normalization: propagated → valid, else pending.
	t.Run("record status normalized", func(t *testing.T) {
		cd := mk(railwayCertValid, true, railwayDNSPropagated, "DNS_RECORD_STATUS_REQUIRES_UPDATE")
		got := toDomainResult(cd)
		if got.Records[0].Status != "valid" {
			t.Errorf("propagated record = %q, want valid", got.Records[0].Status)
		}
		if got.Records[1].Status != "pending" {
			t.Errorf("requires-update record = %q, want pending", got.Records[1].Status)
		}
	})
}

func TestToDomainResultRecordMapping(t *testing.T) {
	cd := railwayCustomDomain{ID: "cd_2"}
	// One record with only hostlabel (no fqdn) to confirm the fallback.
	cd.Status.DNSRecords = append(cd.Status.DNSRecords, struct {
		Hostlabel     string `json:"hostlabel"`
		Fqdn          string `json:"fqdn"`
		RecordType    string `json:"recordType"`
		RequiredValue string `json:"requiredValue"`
		CurrentValue  string `json:"currentValue"`
		Status        string `json:"status"`
		Purpose       string `json:"purpose"`
	}{Hostlabel: "_acme-challenge", RecordType: "DNS_RECORD_TYPE_TXT", RequiredValue: "token123", Status: "PENDING", Purpose: "DNS_RECORD_PURPOSE_ACME_CHALLENGE"})

	got := toDomainResult(cd)
	if len(got.Records) != 1 {
		t.Fatalf("records = %d, want 1", len(got.Records))
	}
	r := got.Records[0]
	if r.Host != "_acme-challenge" {
		t.Errorf("host fell back wrong: %q", r.Host)
	}
	// Railway enums are stripped to plain labels for display.
	if r.Type != "TXT" || r.Value != "token123" || r.Purpose != "ACME CHALLENGE" {
		t.Errorf("record mapped wrong: %+v", r)
	}
}

func TestToDomainResultSynthesizesVerificationTXT(t *testing.T) {
	cd := railwayCustomDomain{ID: "cd_3"}
	cd.Status.CertificateStatus = "CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP"
	cd.Status.Verified = false
	cd.Status.VerificationDNSHost = "_railway-verify.tester"
	cd.Status.VerificationToken = "railway-verify=abc123"
	cd.Status.DNSRecords = append(cd.Status.DNSRecords, struct {
		Hostlabel     string `json:"hostlabel"`
		Fqdn          string `json:"fqdn"`
		RecordType    string `json:"recordType"`
		RequiredValue string `json:"requiredValue"`
		CurrentValue  string `json:"currentValue"`
		Status        string `json:"status"`
		Purpose       string `json:"purpose"`
	}{Fqdn: "tester.primo.page", RecordType: "DNS_RECORD_TYPE_CNAME", RequiredValue: "x.up.railway.app", Status: "DNS_RECORD_STATUS_PROPAGATED", Purpose: "DNS_RECORD_PURPOSE_TRAFFIC_ROUTE"})

	got := toDomainResult(cd)
	if len(got.Records) != 2 {
		t.Fatalf("expected CNAME + synthesized TXT, got %d records: %+v", len(got.Records), got.Records)
	}
	txt := got.Records[1]
	if txt.Type != "TXT" || txt.Host != "_railway-verify.tester" || txt.Value != "railway-verify=abc123" {
		t.Errorf("verification TXT wrong: %+v", txt)
	}
	if txt.Status != "pending" {
		t.Errorf("unverified TXT status = %q, want pending", txt.Status)
	}
	// No verification fields → no synthesized TXT.
	cd2 := railwayCustomDomain{ID: "cd_4"}
	if len(toDomainResult(cd2).Records) != 0 {
		t.Error("expected no records when there are none")
	}
}

func TestRailwayEnumLabel(t *testing.T) {
	cases := []struct{ in, prefix, want string }{
		{"DNS_RECORD_TYPE_CNAME", "DNS_RECORD_TYPE_", "CNAME"},
		{"DNS_RECORD_PURPOSE_TRAFFIC_ROUTE", "DNS_RECORD_PURPOSE_", "TRAFFIC ROUTE"},
		{"CNAME", "DNS_RECORD_TYPE_", "CNAME"}, // no prefix → unchanged
		{"", "DNS_RECORD_TYPE_", ""},
	}
	for _, c := range cases {
		if got := railwayEnumLabel(c.in, c.prefix); got != c.want {
			t.Errorf("railwayEnumLabel(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestMatchCustomDomain(t *testing.T) {
	domains := []railwayCustomDomain{
		{ID: "cd_a", Domain: "one.primo.page"},
		{ID: "cd_b", Domain: "Two.Primo.Page"},
	}
	t.Run("exact match", func(t *testing.T) {
		cd, ok := matchCustomDomain(domains, "one.primo.page")
		if !ok || cd.ID != "cd_a" {
			t.Errorf("got %+v ok=%v, want cd_a", cd, ok)
		}
	})
	t.Run("case-insensitive match", func(t *testing.T) {
		cd, ok := matchCustomDomain(domains, "two.primo.page")
		if !ok || cd.ID != "cd_b" {
			t.Errorf("got %+v ok=%v, want cd_b", cd, ok)
		}
	})
	t.Run("no match", func(t *testing.T) {
		if _, ok := matchCustomDomain(domains, "nope.primo.page"); ok {
			t.Error("expected no match")
		}
	})
	t.Run("empty list", func(t *testing.T) {
		if _, ok := matchCustomDomain(nil, "one.primo.page"); ok {
			t.Error("expected no match on empty list")
		}
	})
}

func TestGetDomainProviderSelection(t *testing.T) {
	t.Run("default is manual", func(t *testing.T) {
		t.Setenv("PRIMO_DOMAIN_PROVIDER", "")
		if getDomainProvider().Name() != "manual" {
			t.Error("expected manual by default")
		}
	})
	t.Run("railway when set", func(t *testing.T) {
		t.Setenv("PRIMO_DOMAIN_PROVIDER", "railway")
		if getDomainProvider().Name() != "railway" {
			t.Error("expected railway provider")
		}
	})
	t.Run("unknown falls back to manual", func(t *testing.T) {
		t.Setenv("PRIMO_DOMAIN_PROVIDER", "nonsense")
		if getDomainProvider().Name() != "manual" {
			t.Error("expected manual fallback")
		}
	})
}

func TestManualProviderSubdomainShortCircuit(t *testing.T) {
	t.Setenv("PRIMO_BASE_DOMAIN", "acme.primo.page")
	p := manualProvider{}

	live, err := p.AttachDomain("foo.acme.primo.page")
	if err != nil {
		t.Fatal(err)
	}
	if live.Status != DomainStatusLive || len(live.Records) != 0 {
		t.Errorf("base subdomain should be live with no records, got %+v", live)
	}

	custom, err := p.AttachDomain("theirbrand.com")
	if err != nil {
		t.Fatal(err)
	}
	if custom.Status != DomainStatusVerifying || len(custom.Records) != 1 {
		t.Errorf("custom domain should return one record, got %+v", custom)
	}
}

func TestHostPattern(t *testing.T) {
	valid := []string{"example.com", "sub.example.com", "a.b.c.example.com", "*.example.com", "my-site.example.io"}
	invalid := []string{"", "example", "http://example.com", "example.com/path", "example .com", "-bad.com", "example.c", "*.*.com"}
	for _, h := range valid {
		if !hostPattern.MatchString(h) {
			t.Errorf("expected %q valid", h)
		}
	}
	for _, h := range invalid {
		if hostPattern.MatchString(h) {
			t.Errorf("expected %q invalid", h)
		}
	}
}
