package internal

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"golang.org/x/net/publicsuffix"
)

const flyMachinesEndpoint = "https://api.machines.dev/v1"

// Each customer app gets its own app-scoped token. Never put the organization
// provisioning token in a customer server's environment.
type flyProvider struct {
	token    string
	app      string
	endpoint string
	client   *http.Client
}

func newFlyProvider() flyProvider {
	return flyProvider{
		token:    strings.TrimSpace(os.Getenv("PRIMO_FLY_TOKEN")),
		app:      strings.TrimSpace(os.Getenv("FLY_APP_NAME")),
		endpoint: flyMachinesEndpoint,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}
func (flyProvider) Name() string { return "fly" }
func (p flyProvider) configured() error {
	var missing []string
	if p.token == "" {
		missing = append(missing, "PRIMO_FLY_TOKEN")
	}
	if p.app == "" {
		missing = append(missing, "FLY_APP_NAME")
	}
	if len(missing) > 0 {
		return fmt.Errorf("fly domain provider not configured: missing %s", strings.Join(missing, ", "))
	}
	return nil
}

type flyAPIError struct{ code int }

func (e flyAPIError) Error() string { return fmt.Sprintf("Fly domain API returned HTTP %d", e.code) }

// Do not include raw API responses in customer-visible errors; they may contain
// credentials echoed by an upstream proxy. Redirects are disabled for the same reason.
func (p flyProvider) request(method, path string, payload any) (flyCertificate, error) {
	var data io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return flyCertificate{}, err
		}
		data = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, p.endpoint+"/apps/"+url.PathEscape(p.app)+"/certificates"+path, data)
	if err != nil {
		return flyCertificate{}, errors.New("Unable to prepare Fly domain request")
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")
	client := *p.client
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := client.Do(req)
	if err != nil {
		return flyCertificate{}, errors.New("Unable to reach Fly domain API; try again shortly")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return flyCertificate{}, flyAPIError{resp.StatusCode}
	}
	var cert flyCertificate
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&cert); err != nil {
		return cert, errors.New("Unable to read Fly domain status; try again shortly")
	}
	return cert, nil
}

// The pre-provisioned wildcard covers exactly one label beneath the workspace.
// Deeper names need their own certificate even though wildcard DNS resolves them.
func coveredByFlyWildcard(host string) bool {
	base := strings.ToLower(baseDomain())
	label := strings.TrimSuffix(strings.ToLower(host), "."+base)
	return base != "" && label != strings.ToLower(host) && label != "" && !strings.Contains(label, ".")
}

func (p flyProvider) AttachDomain(host string) (DomainResult, error) {
	if coveredByFlyWildcard(host) {
		return DomainResult{Status: DomainStatusLive}, nil
	}
	if err := p.configured(); err != nil {
		return DomainResult{}, err
	}
	// Adopt domains attached previously or out of band, without duplicate writes.
	cert, err := p.request("GET", "/"+url.PathEscape(host), nil)
	if err == nil {
		return p.DomainStatus("", host)
	}
	var apiErr flyAPIError
	if !errors.As(err, &apiErr) || apiErr.code != http.StatusNotFound {
		return DomainResult{}, err
	}
	cert, err = p.request("POST", "/acme", map[string]string{"hostname": host})
	if err != nil {
		// A concurrent retry may have created the same hostname first.
		if errors.As(err, &apiErr) && (apiErr.code == http.StatusConflict || apiErr.code == http.StatusUnprocessableEntity) {
			if existing, checkErr := p.DomainStatus("", host); checkErr == nil {
				return existing, nil
			}
		}
		return DomainResult{}, err
	}
	if !strings.EqualFold(cert.Hostname, host) {
		return DomainResult{}, errors.New("Fly returned a different hostname")
	}
	return toFlyDomainResult(cert, time.Now()), nil
}

func (p flyProvider) DomainStatus(_ string, host string) (DomainResult, error) {
	if coveredByFlyWildcard(host) {
		return DomainResult{Status: DomainStatusLive}, nil
	}
	if err := p.configured(); err != nil {
		return DomainResult{}, err
	}
	// Hostname is Fly's handle. Ignore an old Railway provider id after migration.
	cert, err := p.request("POST", "/"+url.PathEscape(host)+"/check", nil)
	if err != nil {
		return DomainResult{}, err
	}
	if !strings.EqualFold(cert.Hostname, host) {
		return DomainResult{}, errors.New("Fly returned a different hostname")
	}
	return toFlyDomainResult(cert, time.Now()), nil
}

type flyCertificate struct {
	Hostname     string `json:"hostname"`
	Configured   bool   `json:"configured"`
	Status       string `json:"status"`
	Certificates []struct {
		Status    string    `json:"status"`
		ExpiresAt time.Time `json:"expires_at"`
	} `json:"certificates"`
	Validation struct {
		DNS       bool `json:"dns_configured"`
		ALPN      bool `json:"alpn_configured"`
		HTTP      bool `json:"http_configured"`
		Ownership bool `json:"ownership_txt_configured"`
	} `json:"validation"`
	Requirements struct {
		A     []string `json:"a"`
		AAAA  []string `json:"aaaa"`
		CNAME string   `json:"cname"`
		ACME  struct {
			Name   string `json:"name"`
			Target string `json:"target"`
		} `json:"acme_challenge"`
		Ownership struct {
			Name     string `json:"name"`
			AppValue string `json:"app_value"`
		} `json:"ownership"`
	} `json:"dns_requirements"`
	Records struct {
		A         []string `json:"a"`
		AAAA      []string `json:"aaaa"`
		CNAME     []string `json:"cname"`
		Resolved  []string `json:"resolved_addresses"`
		ACME      string   `json:"acme_challenge_cname"`
		Ownership string   `json:"ownership_txt"`
	} `json:"dns_records"`
}

func flyDNSMatches(values []string, want string) bool {
	if want == "" {
		return false
	}
	for _, value := range values {
		if strings.EqualFold(strings.TrimSuffix(value, "."), strings.TrimSuffix(want, ".")) {
			return true
		}
	}
	return false
}

func toFlyDomainResult(cert flyCertificate, now time.Time) DomainResult {
	records := make([]DNSRecord, 0, 4)
	add := func(kind, host, value, purpose string, valid bool) {
		if host == "" || value == "" {
			return
		}
		status := "pending"
		if valid {
			status = "valid"
		}
		records = append(records, DNSRecord{Type: kind, Host: host, Value: strings.TrimSuffix(value, "."), Purpose: purpose, Status: status})
	}
	routeValid := cert.Validation.ALPN || cert.Validation.HTTP
	if flyDNSMatches(cert.Records.CNAME, cert.Requirements.CNAME) {
		routeValid = true
	}
	for _, ip := range append(append([]string{}, cert.Requirements.A...), cert.Requirements.AAAA...) {
		if flyDNSMatches(cert.Records.Resolved, ip) || flyDNSMatches(cert.Records.A, ip) || flyDNSMatches(cert.Records.AAAA, ip) {
			routeValid = true
		}
	}
	apex, err := publicsuffix.EffectiveTLDPlusOne(cert.Hostname)
	if err == nil && apex == cert.Hostname && (len(cert.Requirements.A) > 0 || len(cert.Requirements.AAAA) > 0) {
		for _, ip := range cert.Requirements.A {
			add("A", cert.Hostname, ip, "routing", flyDNSMatches(cert.Records.A, ip) || flyDNSMatches(cert.Records.Resolved, ip))
		}
		for _, ip := range cert.Requirements.AAAA {
			add("AAAA", cert.Hostname, ip, "routing", flyDNSMatches(cert.Records.AAAA, ip) || flyDNSMatches(cert.Records.Resolved, ip))
		}
	} else {
		add("CNAME", cert.Hostname, cert.Requirements.CNAME, "routing", routeValid)
	}
	add("CNAME", cert.Requirements.ACME.Name, cert.Requirements.ACME.Target, "acme-challenge", cert.Validation.DNS)
	add("TXT", cert.Requirements.Ownership.Name, cert.Requirements.Ownership.AppValue, "verification", cert.Validation.Ownership)
	active := false
	for _, issued := range cert.Certificates {
		if issued.Status == "active" && issued.ExpiresAt.After(now) {
			active = true
		}
	}
	status := DomainStatusPending
	domainError := ""
	switch {
	case cert.Configured && active && routeValid:
		status = DomainStatusLive
	case strings.EqualFold(cert.Status, "failed") || strings.EqualFold(cert.Status, "error"):
		status = DomainStatusError
		domainError = "Fly could not issue a certificate. Check your DNS records and reconnect the domain."
	case cert.Configured || routeValid || cert.Validation.DNS || cert.Validation.Ownership:
		status = DomainStatusVerifying
	}
	return DomainResult{ProviderID: cert.Hostname, Status: status, Records: records, Error: domainError}
}
