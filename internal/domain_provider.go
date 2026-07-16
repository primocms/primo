package internal

import (
	"os"
	"strings"
)

// Domain status values persisted on the sites collection (domain_status field)
// and returned to the editor. They describe how a real (custom) host got
// connected — the routing key is still the single `host` field.
const (
	DomainStatusNone      = ""          // no custom domain flow (unassigned or base-domain subdomain)
	DomainStatusPending   = "pending"   // attached, waiting for the user to create DNS records
	DomainStatusVerifying = "verifying" // DNS records seen; platform issuing the cert
	DomainStatusLive      = "live"      // records valid + cert issued; serving over HTTPS
	DomainStatusError     = "error"     // attach/verify failed; see domain_error
)

// DNSRecord is one row the user must create at their registrar. Value is what
// they point the record at (CNAME target, TXT token, ACME challenge value).
type DNSRecord struct {
	Type    string `json:"type"`    // CNAME | TXT | A
	Host    string `json:"host"`    // record name/fqdn the user creates
	Value   string `json:"value"`   // value to point it at
	Status  string `json:"status"`  // per-record: pending | valid | invalid
	Purpose string `json:"purpose"` // routing | verification | acme-challenge (informational)
}

// DomainResult is the provider-agnostic outcome of attaching or polling a host.
type DomainResult struct {
	ProviderID string      `json:"provider_id"` // platform handle for later status polls (may be empty)
	Status     string      `json:"status"`      // one of DomainStatus*
	Records    []DNSRecord `json:"records"`
	Error      string      `json:"error,omitempty"`
}

// DomainProvider attaches a custom hostname to this deployment and reports its
// status. Implementations live in this repo and are selected by the
// PRIMO_DOMAIN_PROVIDER env var; only their platform credentials differ.
type DomainProvider interface {
	// AttachDomain registers host with the platform and returns the DNS records
	// the user must create plus the initial status.
	AttachDomain(host string) (DomainResult, error)
	// DomainStatus re-checks a previously attached host. providerID is whatever
	// AttachDomain returned (may be empty for providers that don't need it).
	DomainStatus(providerID, host string) (DomainResult, error)
	// Name identifies the provider (surfaced to the editor via /api/primo/info).
	Name() string
}

// getDomainProvider returns the configured provider. Defaults to manual, which
// needs no platform credentials, so self-hosters and unconfigured instances get
// a coherent (if hands-on) flow rather than an error.
func getDomainProvider() DomainProvider {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("PRIMO_DOMAIN_PROVIDER"))) {
	case "railway":
		return newRailwayProvider()
	default:
		return manualProvider{}
	}
}

// manualProvider is the default. It can't talk to a platform API, so it returns
// generic DNS guidance and optimistically reports the domain live — the actual
// routing/TLS is the operator's responsibility (their reverse proxy). Hosts that
// already sit under the configured base domain need no action at all.
type manualProvider struct{}

func (manualProvider) Name() string { return "manual" }

func (manualProvider) AttachDomain(host string) (DomainResult, error) {
	// A base-domain subdomain is already covered by the wildcard cert/routing —
	// nothing for the user to do.
	if isSubdomainOfBase(host) {
		return DomainResult{Status: DomainStatusLive}, nil
	}
	return DomainResult{
		Status: DomainStatusVerifying,
		Records: []DNSRecord{{
			Type:    "CNAME",
			Host:    host,
			Value:   "(point this at your Primo server)",
			Status:  "pending",
			Purpose: "routing",
		}},
	}, nil
}

func (manualProvider) DomainStatus(_ string, host string) (DomainResult, error) {
	if isSubdomainOfBase(host) {
		return DomainResult{Status: DomainStatusLive}, nil
	}
	// Manual providers can't verify remotely; treat as live once assigned so the
	// UI doesn't spin forever. The operator confirms reachability out of band.
	return DomainResult{Status: DomainStatusLive}, nil
}
