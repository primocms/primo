package hosting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type apiStatus int

var errNotReady = errors.New("DNS and certificate validation is still pending")

func (e apiStatus) Error() string { return fmt.Sprintf("provider returned HTTP %d", e) }

// Every outbound request is bounded and refuses redirects. Upstream bodies and
// command output never become customer-visible errors or logs.
func request(ctx context.Context, client *http.Client, method, endpoint, token string, body, out any) error {
	return requestHeaders(ctx, client, method, endpoint, token, nil, body, out)
}

func requestHeaders(ctx context.Context, client *http.Client, method, endpoint, token string, headers map[string]string, body, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return errors.New("invalid provider request")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	c := *client
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := c.Do(req)
	if err != nil {
		return errors.New("provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return apiStatus(resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out); err != nil {
		return errors.New("invalid provider response")
	}
	return nil
}

type ResendMailer struct {
	Token, From, Endpoint string
	Client                *http.Client
}

func (m ResendMailer) Send(ctx context.Context, to, subject, text, key string) error {
	raw, _ := json.Marshal(map[string]any{"from": m.From, "to": []string{to}, "subject": subject, "text": text})
	req, err := http.NewRequestWithContext(ctx, "POST", m.Endpoint+"/emails", bytes.NewReader(raw))
	if err != nil {
		return errors.New("invalid mail request")
	}
	req.Header.Set("Authorization", "Bearer "+m.Token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", key)
	c := *m.Client
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := c.Do(req)
	if err != nil {
		return errors.New("mail unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return apiStatus(resp.StatusCode)
	}
	return nil
}

type FlyProvisioner struct {
	Config                          Config
	Client                          *http.Client
	FlyEndpoint, CloudflareEndpoint string
	Run                             func(context.Context, string, ...string) ([]byte, error)
}

func NewFlyProvisioner(c Config) *FlyProvisioner {
	p := &FlyProvisioner{Config: c, Client: &http.Client{Timeout: 30 * time.Second}, FlyEndpoint: "https://api.machines.dev/v1", CloudflareEndpoint: "https://api.cloudflare.com/client/v4"}
	p.Run = p.run
	return p
}
func (p *FlyProvisioner) run(ctx context.Context, stdin string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, p.Config.FlyCLI, args...)
	// Supply only the provisioner's configured credential, never an interactive login.
	env := []string{}
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "FLY_API_TOKEN=") && !strings.HasPrefix(item, "FLY_ACCESS_TOKEN=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "FLY_API_TOKEN="+p.Config.FlyToken, "FLY_NO_UPDATE_CHECK=1")
	cmd.Stdin = strings.NewReader(stdin)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, errors.New("Fly command failed")
	}
	return out, nil
}
func (p *FlyProvisioner) fly(ctx context.Context, method, path string, body, out any) error {
	return request(ctx, p.Client, method, p.FlyEndpoint+path, p.Config.FlyToken, body, out)
}
func appPath(j *Job) string { return "/apps/" + url.PathEscape(j.App) }

type dnsRecord struct {
	ID      string `json:"id,omitempty"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	TTL     int    `json:"ttl,omitempty"`
	Proxied bool   `json:"proxied"`
}
type dnsResult struct {
	Success bool        `json:"success"`
	Result  []dnsRecord `json:"result"`
}

func (p *FlyProvisioner) records(ctx context.Context, name string) ([]dnsRecord, error) {
	var out dnsResult
	query := url.Values{"name": {name}, "per_page": {"100"}}
	err := request(ctx, p.Client, "GET", p.CloudflareEndpoint+"/zones/"+p.Config.CloudflareZone+"/dns_records?"+query.Encode(), p.Config.CloudflareToken, nil, &out)
	if err != nil {
		return nil, err
	}
	if !out.Success {
		return nil, errors.New("DNS lookup failed")
	}
	return out.Result, nil
}
func (p *FlyProvisioner) CheckSlug(ctx context.Context, slug string) error {
	if !ValidSlug(slug) {
		return ErrSlug
	}
	host := slug + "." + p.Config.Domain
	for _, name := range []string{host, "*." + host, "_acme-challenge." + host, "_fly-ownership." + host} {
		records, err := p.records(ctx, name)
		if err != nil {
			return err
		}
		if len(records) > 0 {
			return ErrSlug
		}
	}
	return nil
}

func (p *FlyProvisioner) checkCapacity(ctx context.Context) error {
	var out struct {
		Success bool `json:"success"`
		Info    struct {
			Total *int `json:"total_count"`
		} `json:"result_info"`
	}
	err := request(ctx, p.Client, "GET", p.CloudflareEndpoint+"/zones/"+p.Config.CloudflareZone+"/dns_records?per_page=1", p.Config.CloudflareToken, nil, &out)
	if err != nil {
		return err
	}
	if !out.Success || out.Info.Total == nil {
		return errors.New("unable to check DNS capacity")
	}
	limit := p.Config.DNSLimit
	if limit == 0 {
		limit = 200
	}
	if *out.Info.Total+4 > limit {
		return errors.New("DNS record limit needs operator attention")
	}
	return nil
}
func (p *FlyProvisioner) ensureDNS(ctx context.Context, want dnsRecord) error {
	records, err := p.records(ctx, want.Name)
	if err != nil {
		return err
	}
	if len(records) > 1 {
		return errors.New("multiple conflicting DNS records")
	}
	for _, r := range records {
		if r.Type == want.Type && strings.TrimSuffix(r.Content, ".") == strings.TrimSuffix(want.Content, ".") && !r.Proxied {
			return nil
		}
		// Never overwrite existing tenants or redirect traffic from a conflicting record.
		return errors.New("DNS record conflicts with existing service")
	}
	var out struct {
		Success bool `json:"success"`
	}
	err = request(ctx, p.Client, "POST", p.CloudflareEndpoint+"/zones/"+p.Config.CloudflareZone+"/dns_records", p.Config.CloudflareToken, want, &out)
	if err != nil {
		return err
	}
	if !out.Success {
		return errors.New("DNS creation failed")
	}
	return nil
}

type certificate struct {
	Hostname     string `json:"hostname"`
	Configured   bool   `json:"configured"`
	Certificates []struct {
		Status  string    `json:"status"`
		Expires time.Time `json:"expires_at"`
	} `json:"certificates"`
	Requirements struct {
		CNAME string `json:"cname"`
		ACME  struct {
			Name   string `json:"name"`
			Target string `json:"target"`
		} `json:"acme_challenge"`
		Ownership struct {
			Name  string `json:"name"`
			Value string `json:"app_value"`
		} `json:"ownership"`
	} `json:"dns_requirements"`
}

func (p *FlyProvisioner) ensureCert(ctx context.Context, j *Job, host string) (certificate, error) {
	var cert certificate
	err := p.fly(ctx, "GET", appPath(j)+"/certificates/"+url.PathEscape(host), nil, &cert)
	if errors.Is(err, apiStatus(404)) {
		err = p.fly(ctx, "POST", appPath(j)+"/certificates/acme", map[string]string{"hostname": host}, &cert)
		if errors.Is(err, apiStatus(409)) || errors.Is(err, apiStatus(422)) {
			err = p.fly(ctx, "GET", appPath(j)+"/certificates/"+url.PathEscape(host), nil, &cert)
		}
	}
	if err == nil && cert.Hostname != host {
		return cert, errors.New("certificate hostname mismatch")
	}
	return cert, err
}

type machine struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	State      string         `json:"state"`
	Config     map[string]any `json:"config"`
	InstanceID string         `json:"instance_id"`
}

func (p *FlyProvisioner) machines(ctx context.Context, j *Job) ([]machine, error) {
	var out []machine
	err := p.fly(ctx, "GET", appPath(j)+"/machines", nil, &out)
	return out, err
}

func (p *FlyProvisioner) Step(ctx context.Context, j *Job, c *Credentials) error {
	path := appPath(j)
	host := j.Slug + "." + p.Config.Domain
	switch j.State {
	case "app":
		if err := p.checkCapacity(ctx); err != nil {
			return err
		}
		var existing struct {
			Name         string `json:"name"`
			Organization struct {
				Slug string `json:"slug"`
			} `json:"organization"`
		}
		err := p.fly(ctx, "GET", path, nil, &existing)
		if errors.Is(err, apiStatus(404)) {
			if err := p.fly(ctx, "POST", "/apps", map[string]string{"app_name": j.App, "org_slug": p.Config.FlyOrg, "network": j.App}, nil); err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else if existing.Name != j.App || existing.Organization.Slug != p.Config.FlyOrg {
			return errors.New("unexpected existing app")
		}
		j.State = "volume"
	case "volume":
		var volumes []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Region    string `json:"region"`
			State     string `json:"state"`
			Encrypted bool   `json:"encrypted"`
			Attached  string `json:"attached_machine_id"`
		}
		if err := p.fly(ctx, "GET", path+"/volumes", nil, &volumes); err != nil {
			return err
		}
		matched := false
		for _, v := range volumes {
			if v.Name == "pb_data" && v.State != "destroyed" {
				if matched || (j.Volume != "" && j.Volume != v.ID) || v.Region != p.Config.Region || !v.Encrypted {
					return errors.New("unexpected existing volumes")
				}
				matched = true
				j.Volume = v.ID
			}
		}
		if j.Volume != "" && !matched {
			return errors.New("recorded volume is missing")
		}
		if j.Volume == "" {
			var v struct {
				ID string `json:"id"`
			}
			if err := p.fly(ctx, "POST", path+"/volumes", map[string]any{"name": "pb_data", "region": p.Config.Region, "size_gb": 1, "encrypted": true, "auto_backup_enabled": true, "snapshot_retention": 7, "compute": map[string]any{"cpu_kind": "shared", "cpus": 1, "memory_mb": 512}}, &v); err != nil {
				return err
			}
			if v.ID == "" {
				return errors.New("volume ID missing")
			}
			j.Volume = v.ID
		}
		j.State = "token"
	case "token":
		if c.DomainToken == "" {
			token, expiry, err := p.appToken(ctx, j)
			if err != nil {
				return err
			}
			c.DomainToken = token
			j.TokenExpires = expiry
			j.DomainParentHash = hashToken(p.Config.FlyToken)
		}
		j.State = "secrets"
	case "secrets":
		// Use JSON, not dotenv parsing: preserve spaces, #, quotes and backslashes.
		values := map[string]any{"PRIMO_SUPERUSER_EMAIL": "hosting-admin@primo.page", "PRIMO_SUPERUSER_PASSWORD": c.AdminPassword, "PRIMO_USER_EMAIL": j.Email, "PRIMO_USER_PASSWORD": c.Password, "PRIMO_FLY_TOKEN": c.DomainToken}
		var result struct {
			Version uint64 `json:"version"`
		}
		if err := p.fly(ctx, "POST", path+"/secrets", map[string]any{"values": values}, &result); err != nil {
			return err
		}
		if result.Version == 0 {
			return errors.New("secrets version missing")
		}
		j.SecretsVersion = result.Version
		j.State = "machine"
	case "machine":
		machines, err := p.machines(ctx, j)
		if err != nil {
			return err
		}
		if len(machines) > 1 {
			return errors.New("unexpected extra machines")
		}
		if len(machines) == 1 {
			m := machines[0]
			if m.Name != "primo-"+j.ID {
				return errors.New("unexpected existing machine")
			}
			j.Machine = m.ID
		} else {
			var created machine
			config := map[string]any{
				"image": p.Config.Image, "env": map[string]string{"PRIMO_HOSTED_MODE": "true", "PRIMO_MANAGED_BOOTSTRAP": "true", "PRIMO_APP_URL": "https://" + host, "PRIMO_BASE_DOMAIN": host, "PRIMO_SITE_CAP": strconv.Itoa(j.Plan.Sites), "PRIMO_EDITOR_CAP": strconv.Itoa(j.Plan.Editors), "PRIMO_OWNER_ONLY": strconv.FormatBool(j.Plan.OwnerOnly), "PRIMO_DOMAIN_PROVIDER": "fly", "PRIMO_BILLING_URL": p.Config.BillingURL},
				"mounts": []map[string]string{{"volume": j.Volume, "path": "/app/pb_data"}}, "guest": map[string]any{"cpu_kind": "shared", "cpus": 1, "memory_mb": 512},
				"restart": map[string]string{"policy": "always"}, "stop_config": map[string]any{"signal": "SIGTERM", "timeout": "30s"},
				// Boot privately. Networking is added after the bootstrap guard and health check.
				"services": []any{},
			}
			if err := p.fly(ctx, "POST", path+"/machines", map[string]any{"name": "primo-" + j.ID, "region": p.Config.Region, "config": config, "min_secrets_version": j.SecretsVersion}, &created); err != nil {
				return err
			}
			if created.ID == "" {
				return errors.New("machine ID missing")
			}
			j.Machine = created.ID
		}
		j.State = "bootstrap"
	case "bootstrap":
		var result struct {
			ExitCode int    `json:"exit_code"`
			Stdout   string `json:"stdout"`
		}
		if err := p.fly(ctx, "POST", path+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": "wget -q -O - http://127.0.0.1:8080/api/primo/info", "timeout": 10}, &result); err != nil {
			return err
		}
		var info struct {
			Managed   bool   `json:"managed_bootstrap"`
			Hosted    bool   `json:"hosted_mode"`
			Sites     int    `json:"site_cap"`
			Provider  string `json:"domain_provider"`
			OwnerOnly bool   `json:"owner_only"`
		}
		if result.ExitCode != 0 || json.Unmarshal([]byte(result.Stdout), &info) != nil {
			return errors.New("private bootstrap health not ready")
		}
		if !info.Managed || !info.Hosted || info.Sites != j.Plan.Sites || info.OwnerOnly != j.Plan.OwnerOnly || info.Provider != "fly" {
			return errors.New("customer image lacks the managed bootstrap guard or plan configuration")
		}
		j.State = "ips"
	case "ips":
		raw, err := p.Run(ctx, "", "ips", "list", "--app", j.App, "--json")
		if err != nil {
			return err
		}
		var addresses []struct {
			Type string `json:"Type"`
		}
		if json.Unmarshal(raw, &addresses) != nil {
			return errors.New("invalid IP response")
		}
		v4, v6 := false, false
		for _, a := range addresses {
			if a.Type == "shared_v4" || a.Type == "v4" {
				v4 = true
			}
			if a.Type == "v6" {
				v6 = true
			}
		}
		if !v4 {
			if _, err := p.Run(ctx, "", "ips", "allocate-v4", "--shared", "--app", j.App); err != nil {
				return err
			}
		}
		if !v6 {
			if _, err := p.Run(ctx, "", "ips", "allocate-v6", "--app", j.App); err != nil {
				return err
			}
		}
		j.State = "dns"
	case "dns":
		cert, err := p.ensureCert(ctx, j, host)
		if err != nil {
			return err
		}
		wild, err := p.ensureCert(ctx, j, "*."+host)
		if err != nil {
			return err
		}
		if cert.Requirements.CNAME == "" || cert.Requirements.ACME.Name == "" || cert.Requirements.ACME.Target == "" || cert.Requirements.Ownership.Name == "" || cert.Requirements.Ownership.Value == "" {
			return errors.New("missing certificate DNS requirements")
		}
		if wild.Requirements.CNAME != cert.Requirements.CNAME || wild.Requirements.ACME != cert.Requirements.ACME || wild.Requirements.Ownership != cert.Requirements.Ownership {
			return errors.New("wildcard requires different DNS records")
		}
		for _, r := range []dnsRecord{
			{Type: "CNAME", Name: host, Content: cert.Requirements.CNAME, TTL: 60},
			{Type: "CNAME", Name: "*." + host, Content: cert.Requirements.CNAME, TTL: 60},
			{Type: "CNAME", Name: cert.Requirements.ACME.Name, Content: cert.Requirements.ACME.Target, TTL: 60},
			{Type: "TXT", Name: cert.Requirements.Ownership.Name, Content: cert.Requirements.Ownership.Value, TTL: 60},
		} {
			if err := p.ensureDNS(ctx, r); err != nil {
				return err
			}
		}
		j.State = "tls"
	case "tls":
		for _, name := range []string{host, "*." + host} {
			var cert certificate
			if err := p.fly(ctx, "POST", path+"/certificates/"+url.PathEscape(name)+"/check", nil, &cert); err != nil {
				return err
			}
			active := false
			for _, issued := range cert.Certificates {
				if issued.Status == "active" && issued.Expires.After(time.Now()) {
					active = true
				}
			}
			if cert.Hostname != name || !cert.Configured || !active {
				return errNotReady
			}
		}
		j.State = "publish"
	case "publish":
		var m machine
		if err := p.fly(ctx, "GET", path+"/machines/"+j.Machine, nil, &m); err != nil {
			return err
		}
		if m.Name != "primo-"+j.ID {
			return errors.New("machine identity mismatch")
		}
		m.Config["services"] = []map[string]any{{"protocol": "tcp", "internal_port": 8080, "autostop": "off", "autostart": true, "min_machines_running": 1,
			"ports": []map[string]any{{"port": 80, "handlers": []string{"http"}, "force_https": true}, {"port": 443, "handlers": []string{"tls", "http"}}}}}
		if err := p.fly(ctx, "POST", path+"/machines/"+j.Machine, map[string]any{"config": m.Config}, nil); err != nil {
			return err
		}
		j.State = "verify"
	case "verify", "final_check":
		for _, base := range []string{"https://" + host, "https://provision-check." + host} {
			if err := request(ctx, p.Client, "GET", base+"/api/health", "", nil, nil); err != nil {
				return err
			}
		}
		var info struct {
			Hosted    bool   `json:"hosted_mode"`
			Sites     int    `json:"site_cap"`
			Editors   int    `json:"editor_cap"`
			OwnerOnly bool   `json:"owner_only"`
			Provider  string `json:"domain_provider"`
		}
		if err := request(ctx, p.Client, "GET", "https://"+host+"/api/primo/info", "", nil, &info); err != nil {
			return err
		}
		if !info.Hosted || info.Sites != j.Plan.Sites || info.Editors != j.Plan.Editors || info.OwnerOnly != j.Plan.OwnerOnly || info.Provider != "fly" {
			return errors.New("hosted plan or provider mismatch")
		}
		var auth struct {
			Record struct {
				Email string `json:"email"`
				Role  string `json:"serverRole"`
			} `json:"record"`
		}
		if err := request(ctx, p.Client, "POST", "https://"+host+"/api/collections/users/auth-with-password", "", map[string]string{"identity": j.Email, "password": c.Password}, &auth); err != nil {
			return err
		}
		if auth.Record.Email != j.Email || auth.Record.Role != "developer" {
			return errors.New("customer bootstrap mismatch")
		}
		// Primo intentionally hides 'verified' from customer API output. The
		// managed bootstrap guard checks it directly in the database before serving.
		if err := request(ctx, p.Client, "POST", "https://"+host+"/api/collections/_superusers/auth-with-password", "", map[string]string{"identity": "__pbinstaller@example.com", "password": "public-secret"}, nil); err == nil {
			return errors.New("public installer remains accessible")
		} else if !errors.Is(err, apiStatus(400)) && !errors.Is(err, apiStatus(401)) && !errors.Is(err, apiStatus(403)) {
			return err
		}
		if j.State == "final_check" {
			j.State = "ready_email"
		} else {
			j.State = "cleanup"
		}
	case "cleanup":
		var result struct {
			Version uint64 `json:"version"`
		}
		values := map[string]any{"PRIMO_SUPERUSER_EMAIL": nil, "PRIMO_SUPERUSER_PASSWORD": nil, "PRIMO_USER_EMAIL": nil, "PRIMO_USER_PASSWORD": nil}
		if err := p.fly(ctx, "POST", path+"/secrets", map[string]any{"values": values}, &result); err != nil {
			return err
		}
		if result.Version == 0 {
			return errors.New("cleanup secrets version missing")
		}
		j.SecretsVersion = result.Version
		var m machine
		if err := p.fly(ctx, "GET", path+"/machines/"+j.Machine, nil, &m); err != nil {
			return err
		}
		if err := p.fly(ctx, "POST", path+"/machines/"+j.Machine, map[string]any{"config": m.Config, "min_secrets_version": j.SecretsVersion}, nil); err != nil {
			return err
		}
		j.State = "final_check"
	default:
		return errors.New("unknown provisioning phase")
	}
	return nil
}
