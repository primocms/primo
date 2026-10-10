//go:build flyrotation

package hosting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type rotationProofProvider struct {
	*FlyProvisioner
	t *testing.T
}

func (p rotationProofProvider) RotateDomainToken(ctx context.Context, j *Job) error {
	phase := j.DomainRotation.Phase
	err := p.FlyProvisioner.RotateDomainToken(ctx, j)
	if err != nil {
		p.t.Logf("Private Fly update phase %s: %v", phase, err)
	}
	return err
}

// Explicit live test: creates one private disposable app, Machine and volume.
// Normal tests never contact providers. Secrets are read only from private files.
func TestFlyDomainRotationProof(t *testing.T) {
	root := os.Getenv("PRIMO_ROTATION_PROOF_DIR")
	if root == "" {
		t.Fatal("private proof directory required")
	}
	readToken := func(name string) string {
		p := filepath.Join(root, name)
		stat, err := os.Stat(p)
		if err != nil || stat.Mode().Perm()&0077 != 0 {
			t.Fatal("private token file required")
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			t.Fatal("token file unavailable")
		}
		var out struct {
			Token string `json:"token"`
		}
		if json.Unmarshal(raw, &out) != nil || out.Token == "" {
			t.Fatal("token file invalid")
		}
		return out.Token
	}
	image := "registry.fly.io/primo-hosted-smoke@sha256:945631b84980737d2de5356a0511abb518080b1fe16572b600a845b3b3430ebc"
	config := Config{FlyToken: readToken("fly-org-token.json"), FlyOrg: "primo-hosted", CloudflareToken: readToken("cloudflare-token.json"), FlyCLI: "/Users/mateo/Desktop/primo/.tools/fly/bin/flyctl", Domain: "primo.page", Image: image, AlertEmail: "operator@example.com"}
	p := NewFlyProvisioner(config)
	// Only this test transport may fall back to the freshly resolved public API IP.
	// The original HTTPS URL, Host and TLS certificate verification are retained.
	if ip := os.Getenv("PRIMO_MACHINES_API_IP"); net.ParseIP(ip) != nil {
		transport := http.DefaultTransport.(*http.Transport).Clone()
		dialer := &net.Dialer{Timeout: 20 * time.Second}
		transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
			conn, err := dialer.DialContext(ctx, network, address)
			if err != nil && address == "api.machines.dev:443" {
				return dialer.DialContext(ctx, network, net.JoinHostPort(ip, "443"))
			}
			return conn, err
		}
		p.Client = &http.Client{Timeout: 30 * time.Second, Transport: transport}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	token, _ := randomToken()
	id := hashToken(token)[:24]
	j := Job{ID: id, Subscription: "rotation-proof-" + id, State: "ready", App: "primo-c-" + id, Slug: "rotation-proof-" + id[:8]}
	appCreated := false
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if j.Machine != "" {
			if err := p.fly(cleanupCtx, "DELETE", appPath(&j)+"/machines/"+j.Machine+"?force=true", nil, nil); err != nil {
				t.Error("disposable Machine cleanup failed")
			}
		}
		if j.Volume != "" {
			if err := p.fly(cleanupCtx, "DELETE", appPath(&j)+"/volumes/"+j.Volume, nil, nil); err != nil {
				t.Error("disposable volume cleanup failed")
			}
		}
		if appCreated {
			if err := p.fly(cleanupCtx, "DELETE", appPath(&j), nil, nil); err != nil {
				t.Error("disposable app cleanup failed")
			}
		}
	}()
	if err := p.fly(ctx, "POST", "/apps", map[string]string{"app_name": j.App, "org_slug": config.FlyOrg, "network": j.App}, nil); err != nil {
		t.Fatal(err)
	}
	appCreated = true
	var volume struct {
		ID string `json:"id"`
	}
	if err := p.fly(ctx, "POST", appPath(&j)+"/volumes", map[string]any{"name": "pb_data", "region": "iad", "size_gb": 1, "encrypted": true, "auto_backup_enabled": true, "snapshot_retention": 7, "compute": map[string]any{"cpu_kind": "shared", "cpus": 1, "memory_mb": 512}}, &volume); err != nil {
		t.Fatal(err)
	}
	j.Volume = volume.ID
	oldConfig := config
	oldConfig.FlyToken = readToken("fly-org-token-retired-test.private.json")
	old := NewFlyProvisioner(oldConfig)
	old.Client = p.Client
	oldToken, oldExpiry, err := old.appToken(ctx, &j)
	if err != nil {
		t.Fatal(err)
	}
	var secretOut struct {
		Version uint64 `json:"version"`
	}
	if err = p.fly(ctx, "POST", appPath(&j)+"/secrets", map[string]any{"values": map[string]string{"PRIMO_FLY_TOKEN": oldToken}}, &secretOut); err != nil {
		t.Fatal(err)
	}
	password, _ := randomToken()
	admin, _ := randomToken()
	env := map[string]string{"PRIMO_HOSTED_MODE": "true", "PRIMO_MANAGED_BOOTSTRAP": "true", "PRIMO_APP_URL": "https://" + j.Slug + ".primo.page", "PRIMO_BASE_DOMAIN": j.Slug + ".primo.page", "PRIMO_SITE_CAP": "3", "PRIMO_EDITOR_CAP": "0", "PRIMO_OWNER_ONLY": "true", "PRIMO_DOMAIN_PROVIDER": "fly", "PRIMO_SUPERUSER_EMAIL": "hosting-admin@primo.page", "PRIMO_SUPERUSER_PASSWORD": admin, "PRIMO_USER_EMAIL": "rotation-proof@primo.page", "PRIMO_USER_PASSWORD": password}
	var created machine
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines", map[string]any{"name": "primo-" + id, "region": "iad", "min_secrets_version": secretOut.Version, "config": map[string]any{"image": image, "env": env, "mounts": []map[string]string{{"volume": j.Volume, "path": "/app/pb_data"}}, "services": []any{}, "guest": map[string]any{"cpu_kind": "shared", "cpus": 1, "memory_mb": 512}, "restart": map[string]string{"policy": "always"}}}, &created); err != nil {
		t.Fatal(err)
	}
	j.Machine = created.ID
	health := func() {
		t.Helper()
		for attempt := 0; attempt < 40; attempt++ {
			var result struct {
				ExitCode int    `json:"exit_code"`
				Stdout   string `json:"stdout"`
			}
			err := p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": "wget -q -O - http://127.0.0.1:8080/api/primo/info", "timeout": 10}, &result)
			if err == nil && result.ExitCode == 0 && strings.Contains(result.Stdout, `"owner_only":true`) {
				return
			}
			time.Sleep(2 * time.Second)
		}
		t.Fatal("private customer server did not become healthy")
	}
	health()
	var current machine
	if err = p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current); err != nil {
		t.Fatal(err)
	}
	decodedEnv := current.Config["env"].(map[string]any)
	for _, key := range []string{"PRIMO_SUPERUSER_EMAIL", "PRIMO_SUPERUSER_PASSWORD", "PRIMO_USER_EMAIL", "PRIMO_USER_PASSWORD"} {
		delete(decodedEnv, key)
	}
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine, map[string]any{"config": current.Config}, nil); err != nil {
		t.Fatal(err)
	}
	health()
	filename := filepath.Join(t.TempDir(), "rotation.sqlite")
	key := bytes.Repeat([]byte{47}, 32)
	store, err := OpenStore(filename, key)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { store.Close() }()
	j.DomainParentHash = hashToken(oldConfig.FlyToken)
	j.TokenExpires = oldExpiry
	raw, _ := json.Marshal(Credentials{DomainToken: oldToken, AdminPassword: admin})
	j.Secrets, err = store.seal(id+":credentials", string(raw))
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Accept("proof-event", "test", "ready", &j); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	manager := &CredentialManager{Config: config, Store: store, Provider: rotationProofProvider{p, t}, Mailer: &fakeMailer{}, Now: func() time.Time { return now }}
	step := func() {
		t.Helper()
		if err := manager.Run(ctx); err != nil {
			t.Fatal(err)
		}
		now = now.Add(2 * time.Minute)
	}
	step()
	step() // Durable pending restricted credential, before installing it.
	store.Close()
	store, err = OpenStore(filename, key)
	if err != nil {
		t.Fatal(err)
	}
	manager = &CredentialManager{Config: config, Store: store, Provider: rotationProofProvider{p, t}, Mailer: &fakeMailer{}, Now: func() time.Time { return now }}
	step() // install secret; next step applies it to a running Machine
	for i := 0; i < 20; i++ {
		step()
		saved, readErr := store.Get(j.ID)
		if readErr != nil {
			t.Fatal(readErr)
		}
		if saved.DomainRotation.Phase == "" {
			break
		}
		time.Sleep(2 * time.Second)
	}
	activeSaved, readErr := store.Get(j.ID)
	if readErr != nil || activeSaved.DomainRotation.Phase != "" || activeSaved.TokenExpires < oldExpiry+200*86400 {
		t.Fatal("running-server credential update did not complete")
	}
	health()
	// A legacy ready job without a parent marker must also reconcile safely.
	activeSaved.DomainParentHash = ""
	if err = store.Save(activeSaved); err != nil {
		t.Fatal(err)
	}
	step()
	step()
	step()
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/stop", map[string]any{"signal": "SIGTERM", "timeout": "30s"}, nil); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 40; i++ {
		p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current)
		if current.State == "stopped" {
			break
		}
		time.Sleep(time.Second)
	}
	if current.State != "stopped" {
		t.Fatal("test Machine did not stop")
	}
	step()
	p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current)
	if current.State != "stopped" {
		t.Fatal("credential maintenance woke a stopped server")
	}
	saved, _ := store.Get(j.ID)
	if saved.DomainRotation.Phase != "apply" || saved.DomainRotation.Error != "waiting_for_machine" {
		t.Fatal("stopped server update not deferred")
	}
	// The test operator deliberately starts it; maintenance itself never does.
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/start", nil, nil); err != nil {
		t.Fatal(err)
	}
	health()
	for i := 0; i < 20; i++ {
		step()
		saved, err = store.Get(j.ID)
		if err != nil {
			t.Fatal(err)
		}
		if saved.DomainRotation.Phase == "" {
			break
		}
		time.Sleep(2 * time.Second)
	}
	if saved.DomainRotation.Phase != "" || saved.TokenExpires < oldExpiry+200*86400 || saved.DomainParentHash != hashToken(config.FlyToken) {
		t.Fatalf("domain credential renewal did not complete: phase=%s error=%s attempts=%d", saved.DomainRotation.Phase, saved.DomainRotation.Error, saved.DomainRotation.Attempts)
	}
	creds := credentialsOf(t, store, saved)
	if creds.Password != "" || creds.AdminPassword != admin || creds.DomainToken == oldToken || creds.DomainToken == config.FlyToken {
		t.Fatal("credential update retained wrong scope or altered support access")
	}
	if err = request(ctx, p.Client, "GET", p.FlyEndpoint+appPath(&j)+"/certificates", creds.DomainToken, nil, nil); err != nil {
		t.Fatal("renewed token cannot read its certificate API")
	}
	if err = request(ctx, p.Client, "GET", p.FlyEndpoint+"/apps/primo-hosted-smoke", creds.DomainToken, nil, nil); !errors.Is(err, apiStatus(403)) {
		t.Fatal("renewed token can access another app")
	}
	authData, _ := json.Marshal(map[string]string{"identity": "rotation-proof@primo.page", "password": password})
	var authResult struct {
		ExitCode int    `json:"exit_code"`
		Stdout   string `json:"stdout"`
	}
	cmd := "wget -q -O - --header='Content-Type: application/json' --post-data='" + string(authData) + "' http://127.0.0.1:8080/api/collections/users/auth-with-password"
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": cmd, "timeout": 10}, &authResult); err != nil || authResult.ExitCode != 0 {
		t.Fatal("owner sign-in failed after update")
	}
	var auth struct {
		Record struct {
			Email string `json:"email"`
		} `json:"record"`
	}
	if json.Unmarshal([]byte(authResult.Stdout), &auth) != nil || auth.Record.Email != "rotation-proof@primo.page" {
		t.Fatal("restored owner identity mismatch")
	}
	proof := map[string]any{"status": "passed", "app": j.App, "machine": j.Machine, "volume": j.Volume, "customer_image": image, "old_expiry": oldExpiry, "renewed_expiry": saved.TokenExpires, "checks": []string{"running Machine updated from old-parent to new-parent app-only credential", "legacy ready-job parent marker safely reconciled", "pending update survived store restart", "stopped Machine remained stopped", "new secret fingerprint and private health verified", "certificate API accepted renewed app token", "cross-app access denied with 403", "owner sign-in survived update"}, "cleanup": "test defer removes only this disposable app, Machine and volume"}
	raw, _ = json.MarshalIndent(proof, "", "  ")
	if err = os.WriteFile(filepath.Join(root, "domain-rotation-proof.json"), append(raw, '\n'), 0600); err != nil {
		t.Fatal(err)
	}
	t.Log("PASS: actual restricted credential renewal, stopped-server safety, restart recovery, certificate API access and owner sign-in; disposable resources cleaned up")
}
