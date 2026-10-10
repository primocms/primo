package hosting

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

// Org tokens cannot issue deploy tokens. Attenuation is local and only adds
// restrictions; the derived credential retains the parent's expiry/revocation.
func (p *FlyProvisioner) appToken(ctx context.Context, j *Job) (string, int64, error) {
	var app struct {
		Name         string `json:"name"`
		ID           uint64 `json:"internal_numeric_id"`
		Organization struct {
			Slug string `json:"slug"`
		} `json:"organization"`
	}
	if err := p.fly(ctx, "GET", appPath(j), nil, &app); err != nil {
		return "", 0, err
	}
	if app.Name != j.App || app.ID == 0 || app.Organization.Slug != p.Config.FlyOrg {
		return "", 0, errors.New("app identity missing for credential restriction")
	}
	raw, err := p.Run(ctx, "", "tokens", "debug")
	if err != nil {
		return "", 0, err
	}
	expiry, err := parentTokenExpiry(raw, time.Now())
	if err != nil {
		return "", 0, err
	}
	caveats, err := json.Marshal([]map[string]any{
		{"type": "Apps", "body": map[string]any{"apps": map[string]string{strconv.FormatUint(app.ID, 10): "rwcdC"}}},
		{"type": "ValidityWindow", "body": map[string]int64{"not_before": time.Now().Add(-30 * time.Second).Unix(), "not_after": expiry}},
	})
	if err != nil {
		return "", 0, err
	}
	raw, err = p.Run(ctx, string(caveats), "tokens", "attenuate")
	if err != nil {
		return "", 0, err
	}
	token := strings.TrimSpace(string(raw))
	if !strings.HasPrefix(token, "FlyV1 ") || token == p.Config.FlyToken {
		return "", 0, errors.New("invalid restricted app token response")
	}
	// Prove the derived token is accepted before installing it in customer secrets.
	var result struct {
		Name string `json:"name"`
	}
	if err := request(ctx, p.Client, "GET", p.FlyEndpoint+appPath(j), token, nil, &result); err != nil {
		return "", 0, err
	}
	if result.Name != j.App {
		return "", 0, errors.New("restricted token app mismatch")
	}
	return token, expiry, nil
}

func parentTokenExpiry(raw []byte, now time.Time) (int64, error) {
	expiry, err := tokenMetadataExpiry(raw, now)
	if err != nil {
		return 0, err
	}
	if limit := now.Add(365 * 24 * time.Hour).Unix(); expiry > limit {
		expiry = limit
	}
	if expiry <= now.Add(5*time.Minute).Unix() {
		return 0, errors.New("parent token needs renewal")
	}
	return expiry, nil
}

// Monitoring must also report expired parents; issuance rejects them separately.
func tokenMetadataExpiry(raw []byte, now time.Time) (int64, error) {
	var tokens []struct {
		Caveats []struct {
			Type string          `json:"type"`
			Body json.RawMessage `json:"body"`
		} `json:"caveats"`
	}
	if json.Unmarshal(raw, &tokens) != nil || len(tokens) == 0 {
		return 0, errors.New("invalid token metadata")
	}
	expiry := int64(1<<63 - 1)
	found := false
	for _, token := range tokens {
		for _, caveat := range token.Caveats {
			if caveat.Type != "ValidityWindow" {
				continue
			}
			var window struct {
				Before int64 `json:"not_before"`
				After  int64 `json:"not_after"`
			}
			if json.Unmarshal(caveat.Body, &window) != nil || window.After <= 0 || window.Before > now.Unix() {
				return 0, errors.New("invalid parent token validity")
			}
			found = true
			if window.After < expiry {
				expiry = window.After
			}
		}
	}
	if !found {
		return 0, errors.New("parent token validity missing")
	}
	return expiry, nil
}
