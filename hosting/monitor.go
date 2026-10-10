package hosting

import (
	"crypto/subtle"
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"time"
)

// The external monitor receives only aggregate health codes. Its separate key
// cannot read customer jobs, backup object names or credentials, or mutate state.
func (s *Service) monitor(w http.ResponseWriter, r *http.Request) {
	if s.Config.MonitorToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.MonitorToken)) != 1 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	issues := map[string]bool{}
	now := s.now()
	notificationFailed, err := s.Store.purchaseNotificationUnhealthy(now)
	if err != nil {
		http.Error(w, "monitor state unavailable", 503)
		return
	}
	if notificationFailed {
		issues["billing_notification_pending"] = true
	}
	var heartbeat int64
	err = s.Store.db.QueryRowContext(r.Context(), "SELECT completed_at FROM worker_heartbeat WHERE id=1").Scan(&heartbeat)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "monitor state unavailable", 503)
		return
	}
	if heartbeat == 0 || heartbeat < now.Add(-10*time.Minute).Unix() {
		issues["signup_worker_stale"] = true
	}
	credentials, err := s.Store.CredentialStatus()
	if err != nil {
		http.Error(w, "monitor state unavailable", 503)
		return
	}
	if credentials.CheckedAt == 0 || credentials.CheckedAt < now.Add(-2*time.Hour).Unix() || credentials.Error != "" {
		issues["provider_check_unhealthy"] = true
	}
	if credentials.FlyExpires <= now.Add(7*24*time.Hour).Unix() || credentials.CloudflareExpires <= now.Add(7*24*time.Hour).Unix() {
		issues["provider_credential_expiring"] = true
	}
	backups, err := s.Store.BackupStatus()
	if err != nil {
		http.Error(w, "monitor state unavailable", 503)
		return
	}
	completed := map[string]int64{}
	for _, b := range backups {
		completed[b.Target] = b.CompletedAt
	}
	if !s.Config.Backups.Enabled {
		issues["backups_disabled"] = true
	} else if completed["control-plane"] < now.Add(-36*time.Hour).Unix() {
		issues["control_backup_stale"] = true
	}
	jobs, err := s.Store.Jobs()
	if err != nil {
		http.Error(w, "monitor state unavailable", 503)
		return
	}
	active, suspended := 0, 0
	for _, j := range jobs {
		if j.Retired {
			continue
		}
		after, err := s.Store.SuspendAfter(j.Subscription)
		if err != nil {
			http.Error(w, "monitor state unavailable", 503)
			return
		}
		if after > 0 {
			if j.Suspension.CompletedAt > 0 {
				suspended++
				continue
			}
			if j.Machine != "" && (j.Suspension.Attempts >= 3 || after < now.Add(-10*time.Minute).Unix()) {
				issues["suspension_pending"] = true
			}
			// Scheduled paid-period access still needs daily backups until suspension.
		}
		held, err := s.Store.Held(j.Subscription)
		if err != nil {
			http.Error(w, "monitor state unavailable", 503)
			return
		}
		if held && after == 0 {
			issues["billing_review_pending"] = true
		}
		if j.State == "ready" {
			active++
			readyAt := j.ReadyAt
			if readyAt == 0 {
				readyAt = j.UpdatedAt
			}
			if s.Config.Backups.Enabled && j.Suspension.Phase == "" && readyAt < now.Add(-2*time.Hour).Unix() && completed[j.ID] < now.Add(-36*time.Hour).Unix() {
				issues["customer_backup_stale"] = true
			}
			if j.Suspension.Phase == "" && (j.DomainRotation.Attempts >= 3 || j.TokenExpires <= now.Add(7*24*time.Hour).Unix()) {
				issues["customer_domain_update_unhealthy"] = true
			}
		} else if after == 0 && (j.State == "attention" || j.Attempts >= 3 || (j.StartedAt > 0 && j.StartedAt < now.Add(-25*time.Minute).Unix() && j.State != "awaiting_claim")) {
			issues["signup_needs_attention"] = true
		}
	}
	codes := []string{}
	for code := range issues {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	// Health issues use 200 so an authenticated external client can parse precise
	// codes. Database/transport failures use 503 and are independently actionable.
	jsonResponse(w, 200, map[string]any{"schema": 1, "ok": len(codes) == 0, "checked_at": now.Unix(), "issues": codes, "active_servers": active, "suspended_servers": suspended})
}
