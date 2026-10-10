package hosting

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func monitorReady(t *testing.T, s *Service) {
	t.Helper()
	s.Config.MonitorToken = strings.Repeat("monitor", 8)
	s.Config.Backups.Enabled = true
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(CredentialStatus{CheckedAt: s.now().Unix(), FlyExpires: s.now().Add(365 * 24 * time.Hour).Unix(), CloudflareExpires: s.now().Add(365 * 24 * time.Hour).Unix()})
	if _, err := s.Store.db.Exec("INSERT INTO credential_status VALUES(1,?)", raw); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Store.db.Exec("INSERT INTO backup_runs VALUES(?,?,?)", "control-plane", "private-backup-name", s.now().Unix()); err != nil {
		t.Fatal(err)
	}
}
func monitorResult(t *testing.T, s *Service) map[string]any {
	t.Helper()
	req := httptest.NewRequest("GET", "/ops/monitor", nil)
	req.Header.Set("Authorization", "Bearer "+s.Config.MonitorToken)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("monitor=%d", w.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	for _, private := range []string{"@example.com", "private-backup-name", "FlyV1", s.Config.OpsToken, "subscription-1"} {
		if strings.Contains(w.Body.String(), private) {
			t.Fatal("monitor leaks private details")
		}
	}
	return out
}
func TestMonitorKeyIsReadOnlyAndReportsWorkerFailure(t *testing.T) {
	s, _, _ := fixture(t)
	monitorReady(t, s)
	if monitorResult(t, s)["ok"] != true {
		t.Fatal("healthy state rejected")
	}
	for _, path := range []string{"/ops/jobs", "/ops/backups", "/ops/credentials"} {
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Authorization", "Bearer "+s.Config.MonitorToken)
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, req)
		if w.Code != 401 {
			t.Fatal("monitor key grants operator access")
		}
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/ops/monitor", nil))
	if w.Code != 401 {
		t.Fatal("public monitor access")
	}
	now := s.now().Add(11 * time.Minute)
	s.Now = func() time.Time { return now }
	out := monitorResult(t, s)
	if out["ok"] != false || !strings.Contains(strings.Join(toStrings(out["issues"].([]any)), ","), "signup_worker_stale") {
		t.Fatal("dead worker missed")
	}
}
func toStrings(values []any) []string {
	out := []string{}
	for _, v := range values {
		out = append(out, v.(string))
	}
	return out
}
func TestMonitorBackupAndSuspensionCoverage(t *testing.T) {
	s, _, _ := fixture(t)
	monitorReady(t, s)
	j := enqueue(t, s)
	j.State = "ready"
	j.ReadyAt = s.now().Add(-3 * time.Hour).Unix()
	j.TokenExpires = s.now().Add(365 * 24 * time.Hour).Unix()
	s.Store.Save(j)
	out := monitorResult(t, s)
	if out["ok"] != false || out["active_servers"] != float64(1) {
		t.Fatal("missing customer backup ignored")
	}
	j.Suspension.CompletedAt = s.now().Unix()
	s.Store.Save(j)
	s.Store.Revoke("revoked", j.Subscription, s.now().Add(-time.Minute).Unix())
	out = monitorResult(t, s)
	if out["ok"] != true || out["suspended_servers"] != float64(1) || out["active_servers"] != float64(0) {
		t.Fatal("suspended customer incorrectly needs live backups")
	}
	j.Retired = true
	s.Store.Save(j)
	out = monitorResult(t, s)
	if out["ok"] != true || out["suspended_servers"] != float64(0) {
		t.Fatal("retired test customer included")
	}
}
