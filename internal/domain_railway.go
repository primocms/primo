package internal

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Railway GraphQL endpoint (current canonical host; the .app host is legacy).
const railwayGraphQLEndpoint = "https://backboard.railway.com/graphql/v2"

// railwayProvider attaches custom domains via Railway's public GraphQL API.
// It reads the project/environment/service ids Railway injects into every
// running container, plus a project-scoped token, so it manages exactly the one
// deployment it runs in.
//
// The selection set and status/enum handling were verified against Railway's
// schema via introspection (CustomDomainStatus / DNSRecords / CertificateStatus
// / DNSRecordStatus). Wildcard `_acme-challenge` records flow through the same
// generic dnsRecords[] mapping, so no special-casing is required.
type railwayProvider struct {
	token         string
	projectID     string
	environmentID string
	serviceID     string
	client        *http.Client
}

func newRailwayProvider() railwayProvider {
	return railwayProvider{
		// Project-Access-Token, least-privilege, scoped to this project/env.
		token:         strings.TrimSpace(os.Getenv("PRIMO_RAILWAY_TOKEN")),
		projectID:     os.Getenv("RAILWAY_PROJECT_ID"),
		environmentID: os.Getenv("RAILWAY_ENVIRONMENT_ID"),
		serviceID:     os.Getenv("RAILWAY_SERVICE_ID"),
		client:        &http.Client{Timeout: 30 * time.Second},
	}
}

func (railwayProvider) Name() string { return "railway" }

func (p railwayProvider) configured() error {
	var missing []string
	if p.token == "" {
		missing = append(missing, "PRIMO_RAILWAY_TOKEN")
	}
	if p.projectID == "" {
		missing = append(missing, "RAILWAY_PROJECT_ID")
	}
	if p.environmentID == "" {
		missing = append(missing, "RAILWAY_ENVIRONMENT_ID")
	}
	if p.serviceID == "" {
		missing = append(missing, "RAILWAY_SERVICE_ID")
	}
	if len(missing) > 0 {
		return fmt.Errorf("railway domain provider not configured: missing %s", strings.Join(missing, ", "))
	}
	return nil
}

// graphql runs a GraphQL request and unmarshals `data` into out.
func (p railwayProvider) graphql(query string, variables map[string]any, out any) error {
	payload, err := json.Marshal(map[string]any{"query": query, "variables": variables})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", railwayGraphQLEndpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	// Project tokens use the Project-Access-Token header, NOT Authorization.
	req.Header.Set("Project-Access-Token", p.token)

	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("railway API %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return err
	}
	if len(envelope.Errors) > 0 {
		return errors.New("railway API: " + envelope.Errors[0].Message)
	}
	if out != nil && len(envelope.Data) > 0 {
		return json.Unmarshal(envelope.Data, out)
	}
	return nil
}

// railwayCustomDomain mirrors the customDomainCreate/customDomain selection
// set, verified against Railway's schema via introspection (CustomDomainStatus
// / DNSRecords / CertificateStatus). Fields absent in a response stay
// zero-valued (defensive).
type railwayCustomDomain struct {
	ID     string `json:"id"`
	Domain string `json:"domain"`
	Status struct {
		CertificateStatus string `json:"certificateStatus"` // CERTIFICATE_STATUS_TYPE_*
		Verified          bool   `json:"verified"`
		DNSRecords        []struct {
			Hostlabel     string `json:"hostlabel"`
			Fqdn          string `json:"fqdn"`
			RecordType    string `json:"recordType"`
			RequiredValue string `json:"requiredValue"`
			CurrentValue  string `json:"currentValue"`
			Status        string `json:"status"` // DNS_RECORD_STATUS_*
			Purpose       string `json:"purpose"`
		} `json:"dnsRecords"`
	} `json:"status"`
}

const railwayDomainSelection = `
	id
	domain
	status {
		certificateStatus
		verified
		dnsRecords {
			hostlabel
			fqdn
			recordType
			requiredValue
			currentValue
			status
			purpose
		}
	}`

func (p railwayProvider) AttachDomain(host string) (DomainResult, error) {
	if err := p.configured(); err != nil {
		return DomainResult{}, err
	}

	mutation := `mutation customDomainCreate($input: CustomDomainCreateInput!) {
		customDomainCreate(input: $input) {` + railwayDomainSelection + `
		}
	}`
	var data struct {
		CustomDomainCreate railwayCustomDomain `json:"customDomainCreate"`
	}
	err := p.graphql(mutation, map[string]any{
		"input": map[string]any{
			"projectId":     p.projectID,
			"environmentId": p.environmentID,
			"serviceId":     p.serviceID,
			"domain":        host,
		},
	}, &data)
	if err != nil {
		return DomainResult{}, err
	}
	return toDomainResult(data.CustomDomainCreate), nil
}

func (p railwayProvider) DomainStatus(providerID, host string) (DomainResult, error) {
	if err := p.configured(); err != nil {
		return DomainResult{}, err
	}
	if providerID == "" {
		return DomainResult{}, errors.New("missing railway custom domain id")
	}

	query := `query customDomain($id: String!, $projectId: String!) {
		customDomain(id: $id, projectId: $projectId) {` + railwayDomainSelection + `
		}
	}`
	var data struct {
		CustomDomain railwayCustomDomain `json:"customDomain"`
	}
	err := p.graphql(query, map[string]any{
		"id":        providerID,
		"projectId": p.projectID,
	}, &data)
	if err != nil {
		return DomainResult{}, err
	}
	return toDomainResult(data.CustomDomain), nil
}

// Railway enum values (verified via schema introspection).
const (
	railwayDNSPropagated = "DNS_RECORD_STATUS_PROPAGATED"
	railwayCertValid     = "CERTIFICATE_STATUS_TYPE_VALID"
	railwayCertIssueFail = "CERTIFICATE_STATUS_TYPE_ISSUE_FAILED"
)

// toDomainResult maps a Railway custom domain into the provider-agnostic result.
// Overall status is driven by the real certificateStatus field (Railway issues
// the Let's Encrypt cert automatically once DNS verifies): a valid cert means
// live, a failed issue means error, and anything in between is still verifying
// once at least the records exist. Per-record status is normalized so the UI can
// tick off records as they propagate.
func toDomainResult(cd railwayCustomDomain) DomainResult {
	records := make([]DNSRecord, 0, len(cd.Status.DNSRecords))
	for _, r := range cd.Status.DNSRecords {
		name := r.Fqdn
		if name == "" {
			name = r.Hostlabel
		}
		// Normalize Railway's DNS enum to the simple "valid"/"pending" the UI
		// renders (a green check when propagated).
		recStatus := "pending"
		if r.Status == railwayDNSPropagated {
			recStatus = "valid"
		}
		records = append(records, DNSRecord{
			Type:    r.RecordType,
			Host:    name,
			Value:   r.RequiredValue,
			Status:  recStatus,
			Purpose: r.Purpose,
		})
	}

	status := DomainStatusPending
	switch {
	case cd.Status.CertificateStatus == railwayCertValid:
		status = DomainStatusLive
	case cd.Status.CertificateStatus == railwayCertIssueFail:
		status = DomainStatusError
	case len(records) > 0 || cd.Status.Verified:
		// Records exist / ownership verified but cert not yet issued.
		status = DomainStatusVerifying
	}

	return DomainResult{
		ProviderID: cd.ID,
		Status:     status,
		Records:    records,
	}
}
