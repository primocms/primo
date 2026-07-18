package internal

import "testing"

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
