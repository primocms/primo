//go:build flysuspension

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

// Explicit live test: creates one private disposable app, Machine and volume.
// Normal tests never contact providers. Secrets are read only from private files.
func TestFlySuspensionProof(t *testing.T) {
	root := os.Getenv("PRIMO_SUSPENSION_PROOF_DIR")
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
	j := Job{ID: id, Subscription: "suspension-proof-" + id, State: "ready", App: "primo-c-" + id, Slug: "suspension-proof-" + id[:8]}
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
	oldConfig.FlyToken = config.FlyToken
	old := NewFlyProvisioner(oldConfig)
	old.Client = p.Client
	oldToken, _, err := old.appToken(ctx, &j)
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
	env := map[string]string{"PRIMO_HOSTED_MODE": "true", "PRIMO_MANAGED_BOOTSTRAP": "true", "PRIMO_APP_URL": "https://" + j.Slug + ".primo.page", "PRIMO_BASE_DOMAIN": j.Slug + ".primo.page", "PRIMO_SITE_CAP": "3", "PRIMO_EDITOR_CAP": "0", "PRIMO_OWNER_ONLY": "true", "PRIMO_DOMAIN_PROVIDER": "fly", "PRIMO_SUPERUSER_EMAIL": "hosting-admin@primo.page", "PRIMO_SUPERUSER_PASSWORD": admin, "PRIMO_USER_EMAIL": "suspension-proof@primo.page", "PRIMO_USER_PASSWORD": password}
	var created machine
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines", map[string]any{"name": "primo-" + id, "region": "iad", "min_secrets_version": secretOut.Version, "config": map[string]any{"image": image, "env": env, "mounts": []map[string]string{{"volume": j.Volume, "path": "/app/pb_data"}}, "services": []any{map[string]any{"protocol": "tcp", "internal_port": 8080, "autostart": true, "autostop": "off", "min_machines_running": 1, "ports": []map[string]any{{"port": 80, "handlers": []string{"http"}}}}}, "guest": map[string]any{"cpu_kind": "shared", "cpus": 1, "memory_mb": 512}, "restart": map[string]string{"policy": "always"}}}, &created); err != nil {
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
	current = machine{}
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
	filename := filepath.Join(t.TempDir(), "suspension.sqlite")
	key := bytes.Repeat([]byte{63}, 32)
	store, err := OpenStore(filename, key)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { store.Close() }()
	if err = store.Accept("proof-order", "test", "ready", &j); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	s := &Service{Config: config, Store: store, Provisioner: p, Suspender: p, Mailer: &fakeMailer{}, Now: func() time.Time { return now }}
	var output struct {
		ExitCode int    `json:"exit_code"`
		Stdout   string `json:"stdout"`
	}
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": "sh -c 'printf cancellation-proof > /app/pb_data/suspension-proof.txt'", "timeout": 10}, &output); err != nil || output.ExitCode != 0 {
		t.Fatal("data marker could not be created")
	}
	login := func() {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"identity": "suspension-proof@primo.page", "password": password})
		cmd := "wget -q -O - --header='Content-Type: application/json' --post-data='" + string(body) + "' http://127.0.0.1:8080/api/collections/users/auth-with-password"
		var result struct {
			ExitCode int    `json:"exit_code"`
			Stdout   string `json:"stdout"`
		}
		if err := p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": cmd, "timeout": 10}, &result); err != nil || result.ExitCode != 0 {
			t.Fatal("owner sign-in failed")
		}
		var auth struct {
			Record struct {
				Email string `json:"email"`
			} `json:"record"`
		}
		if json.Unmarshal([]byte(result.Stdout), &auth) != nil || auth.Record.Email != "suspension-proof@primo.page" {
			t.Fatal("owner identity not retained")
		}
	}
	login()
	if err = store.Revoke("terminal-event", j.Subscription, now.Add(time.Hour).Unix()); err != nil {
		t.Fatal(err)
	}
	if err = s.Tick(ctx, "proof-worker"); err != nil {
		t.Fatal(err)
	}
	current = machine{}
	if err = p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current); err != nil || current.State != "started" {
		t.Fatal("paid access ended early")
	}
	now = now.Add(time.Hour + time.Second)
	if err = s.Tick(ctx, "proof-worker"); err != nil {
		t.Fatal(err)
	} // capture only; durable restore config
	saved, _ := store.Get(j.ID)
	if saved.Suspension.Phase != "isolate" || saved.Suspension.SavedConfig == nil {
		t.Fatal("config not durably captured")
	}
	store.Close()
	store, err = OpenStore(filename, key)
	if err != nil {
		t.Fatal(err)
	}
	s.Store = store
	for i := 0; i < 30; i++ {
		if err = s.Tick(ctx, "proof-worker"); err != nil {
			t.Fatal(err)
		}
		saved, _ = store.Get(j.ID)
		if saved.Suspension.CompletedAt > 0 {
			break
		}
		now = now.Add(time.Minute)
		time.Sleep(2 * time.Second)
	}
	if saved.Suspension.CompletedAt == 0 {
		t.Fatalf("suspension failed phase=%s attempts=%d", saved.Suspension.Phase, saved.Suspension.Attempts)
	}
	current = machine{}
	if err = p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current); err != nil || (current.State != "stopped" && current.State != "created") || !suspensionConfig(current.Config) {
		t.Fatalf("server not isolated and stopped: state=%s isolated=%v", current.State, suspensionConfig(current.Config))
	}
	if err = p.fly(ctx, "GET", appPath(&j)+"/volumes/"+j.Volume, nil, nil); err != nil {
		t.Fatal("customer volume not retained")
	}
	if err = p.fly(ctx, "GET", appPath(&j), nil, nil); err != nil {
		t.Fatal("customer app not retained")
	}
	s.Tick(ctx, "proof-worker")
	current = machine{}
	if err = p.fly(ctx, "GET", appPath(&j)+"/machines/"+j.Machine, nil, &current); err != nil || (current.State != "stopped" && current.State != "created") {
		t.Fatal("worker woke suspended customer")
	}
	// Only the test operator resumes it. Runtime billing cannot clear the hold.
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine, map[string]any{"config": saved.Suspension.SavedConfig, "current_version": current.InstanceID, "skip_launch": true}, nil); err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 20; attempt++ {
		err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/start", nil, nil)
		if err == nil {
			break
		}
		if !errors.Is(err, apiStatus(412)) && !errors.Is(err, apiStatus(409)) {
			t.Fatal(err)
		}
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		t.Fatal("manual restoration did not become ready to start")
	}
	health()
	login()
	if err = p.fly(ctx, "POST", appPath(&j)+"/machines/"+j.Machine+"/exec", map[string]any{"cmd": "cat /app/pb_data/suspension-proof.txt", "timeout": 10}, &output); err != nil || output.ExitCode != 0 || strings.TrimSpace(output.Stdout) != "cancellation-proof" {
		t.Fatal("customer data lost")
	}
	proof := map[string]any{"status": "passed", "app": j.App, "machine": j.Machine, "volume": j.Volume, "customer_image": image, "checks": []string{"access retained through paid period", "original configuration checkpoint survives SQLite reopen", "public routes removed and restart disabled", "Machine stopped while app and encrypted volume retained", "repeated worker check keeps Machine off", "manual restoration preserves owner sign-in and customer file"}, "cleanup": "test defer removes only this disposable app, Machine and volume"}
	raw, _ := json.MarshalIndent(proof, "", "  ")
	if err = os.WriteFile(filepath.Join(root, "suspension-proof.json"), append(raw, '\n'), 0600); err != nil {
		t.Fatal(err)
	}
	t.Log("PASS: actual Fly paid-period access, durable suspension, retained data and reviewed restoration; disposable resources cleaned up")
}
