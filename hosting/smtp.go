package hosting

import (
	"context"
	"errors"
	"net/mail"
	"net/url"
	"strings"
)

// Each customer receives only a sending-only, domain-restricted credential.
// The management credential never leaves the control plane. A separate worker
// checkpoint saves the returned password encrypted before customer setup begins.
func (p *FlyProvisioner) createSMTPKey(ctx context.Context, j *Job, c *Credentials) error {
	if p.Config.SMTPManagementToken == "" || p.Config.SMTPDomainID == "" {
		return errors.New("hosted SMTP configuration missing")
	}
	if j.SMTPKeyID != "" && c.SMTPPassword != "" {
		j.State = "smtp_settings"
		return nil
	}
	name := "primo-hosted-" + j.ID
	if len(j.ID) != 24 || strings.Trim(j.ID, "0123456789abcdef") != "" {
		return errors.New("invalid SMTP customer identity")
	}
	// Resend exposes a newly created token once. Reconcile a lost create response
	// or checkpoint by revoking only orphan keys with this exact job-owned name.
	orphanIDs := []string{}
	after := ""
	for page := 0; ; page++ {
		if page >= 20 {
			return errors.New("SMTP key listing exceeded safety limit")
		}
		var keys struct {
			Data    []struct{ ID, Name string }
			HasMore bool `json:"has_more"`
		}
		endpoint := "https://api.resend.com/api-keys?limit=100"
		if after != "" {
			endpoint += "&after=" + url.QueryEscape(after)
		}
		if err := request(ctx, p.Client, "GET", endpoint, p.Config.SMTPManagementToken, nil, &keys); err != nil {
			return err
		}
		for _, key := range keys.Data {
			if key.ID == "" {
				return errors.New("invalid SMTP key listing")
			}
			if key.Name == name {
				orphanIDs = append(orphanIDs, key.ID)
			}
		}
		if !keys.HasMore {
			break
		}
		if len(keys.Data) == 0 || keys.Data[len(keys.Data)-1].ID == after {
			return errors.New("invalid SMTP key pagination")
		}
		after = keys.Data[len(keys.Data)-1].ID
	}
	for _, id := range orphanIDs {
		if err := p.deleteSMTPKey(ctx, id); err != nil {
			return err
		}
	}
	var key struct{ ID, Token string }
	if err := request(ctx, p.Client, "POST", "https://api.resend.com/api-keys", p.Config.SMTPManagementToken,
		map[string]string{"name": name, "permission": "sending_access", "domain_id": p.Config.SMTPDomainID}, &key); err != nil {
		return err
	}
	if key.ID == "" || !strings.HasPrefix(key.Token, "re_") || key.Token == p.Config.SMTPManagementToken || key.Token == p.Config.ResendToken {
		return errors.New("invalid customer SMTP credential")
	}
	j.SMTPKeyID, c.SMTPPassword = key.ID, key.Token
	j.State = "smtp_settings"
	return nil
}

func (p *FlyProvisioner) deleteSMTPKey(ctx context.Context, id string) error {
	if p.Config.SMTPManagementToken == "" {
		return errors.New("SMTP management credential missing")
	}
	err := request(ctx, p.Client, "DELETE", "https://api.resend.com/api-keys/"+url.PathEscape(id), p.Config.SMTPManagementToken, nil, nil)
	if errors.Is(err, apiStatus(404)) {
		return nil
	}
	return err
}

// Retirement is explicit operator bookkeeping after removing a customer app.
// A failed or lost revocation response remains retryable; 404 means completed.
func (p *FlyProvisioner) RevokeSMTPKey(ctx context.Context, j *Job) error {
	if j.SMTPKeyID == "" {
		return nil
	}
	return p.deleteSMTPKey(ctx, j.SMTPKeyID)
}

func (p *FlyProvisioner) configureSMTP(ctx context.Context, j *Job, c *Credentials) error {
	if j.SMTPKeyID == "" || c.SMTPPassword == "" || c.AdminPassword == "" {
		return errors.New("customer SMTP setup credential missing")
	}
	base := "https://" + j.Slug + "." + p.Config.Domain
	var auth struct{ Token string }
	if err := request(ctx, p.Client, "POST", base+"/api/collections/_superusers/auth-with-password", "", map[string]string{"identity": "hosting-admin@primo.page", "password": c.AdminPassword}, &auth); err != nil {
		return err
	}
	if auth.Token == "" {
		return errors.New("customer SMTP authentication failed")
	}
	var settings struct {
		Meta map[string]any
		SMTP struct {
			Enabled, TLS               bool
			Host, Username, AuthMethod string
			Port                       int
		}
	}
	if err := request(ctx, p.Client, "GET", base+"/api/settings", auth.Token, nil, &settings); err != nil {
		return err
	}
	sender, err := mail.ParseAddress(p.Config.FromEmail)
	if err != nil || !strings.HasSuffix(sender.Address, "@email.primo.build") {
		return errors.New("invalid hosted SMTP sender")
	}
	if settings.Meta == nil {
		settings.Meta = map[string]any{}
	}
	name := sender.Name
	if name == "" {
		name = "Primo"
	}
	settings.Meta["senderName"], settings.Meta["senderAddress"], settings.Meta["appURL"] = name, sender.Address, base
	body := map[string]any{"meta": settings.Meta, "smtp": map[string]any{"enabled": true, "host": "smtp.resend.com", "port": 465, "tls": true, "username": "resend", "password": c.SMTPPassword, "authMethod": "PLAIN"}}
	if err := request(ctx, p.Client, "PATCH", base+"/api/settings", auth.Token, body, nil); err != nil {
		return err
	}
	if err := request(ctx, p.Client, "GET", base+"/api/settings", auth.Token, nil, &settings); err != nil {
		return err
	}
	if !settings.SMTP.Enabled || !settings.SMTP.TLS || settings.SMTP.Host != "smtp.resend.com" || settings.SMTP.Port != 465 || settings.SMTP.Username != "resend" || settings.SMTP.AuthMethod != "PLAIN" || settings.Meta["senderAddress"] != sender.Address || settings.Meta["appURL"] != base {
		return errors.New("customer SMTP verification failed")
	}
	return nil
}
