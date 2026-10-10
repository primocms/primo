package hosting

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type operatorFailureMailer struct {
	customer, operator []string
	fail               bool
}

func (m *operatorFailureMailer) Send(_ context.Context, to, subject, body, key string) error {
	if to == "operator@example.com" {
		m.operator = append(m.operator, key)
		if m.fail {
			return errors.New("sending failed with sensitive upstream details")
		}
	} else {
		m.customer = append(m.customer, subject)
	}
	return nil
}

func TestPurchaseNotificationSurvivesRestartDeduplicatesAndEncrypts(t *testing.T) {
	s, _, m := fixture(t)
	s.Config.AlertEmail = "operator@example.com"
	raw := paidPayload(s, "subscription_create", "maker-product", "sub", s.now())
	for _, id := range []string{"purchase", "purchase", "redelivery"} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, signedRequest(s, id, raw))
		if w.Code != 202 {
			t.Fatal(w.Code)
		}
	}
	var count int
	var blob string
	if err := s.Store.db.QueryRow("SELECT COUNT(*),payload FROM billing_notifications").Scan(&count, &blob); err != nil {
		t.Fatal(err)
	}
	if count != 1 || strings.Contains(blob, "customer@example.com") || strings.Contains(blob, "order-1") {
		t.Fatal("notification duplicated or leaked plaintext")
	}
	filename := filepath.Join(t.TempDir(), "restart.sqlite")
	if _, err := s.Store.db.Exec("VACUUM INTO ?", filename); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenStore(filename, bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s.Store = reopened
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.messages) != 2 || !strings.Contains(m.messages[1], "operator@example.com\nNew Primo purchase") || strings.Contains(m.messages[1], "/setup#") {
		t.Fatal("operator notice missing or contained a private setup link")
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.messages) != 2 {
		t.Fatal("sent notification repeated after checkpoint")
	}
}

func TestOperatorEmailFailureDoesNotFailCustomerAndRetriesStableKey(t *testing.T) {
	s, p, _ := fixture(t)
	s.Config.AlertEmail = "operator@example.com"
	m := &operatorFailureMailer{fail: true}
	s.Mailer = m
	j := enqueue(t, s)
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	j, _ = s.Store.Get(j.ID)
	if j.State != "awaiting_claim" || j.Attempts != 0 || len(m.customer) != 1 {
		t.Fatal("operator failure affected purchaser invitation")
	}
	var attempts int
	s.Store.db.QueryRow("SELECT attempts FROM billing_notifications").Scan(&attempts)
	if attempts != 1 {
		t.Fatal("email failure was not checkpointed")
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, claimRequest(s, claimToken(t, s, j), "notification-owner", "good owner password"))
	if w.Code != 202 {
		t.Fatal(w.Code)
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if p.calls != 1 || len(m.operator) != 1 {
		t.Fatal("backoff blocked customer provision or retried too early")
	}
	now := s.now().Add(time.Minute)
	s.Now = func() time.Time { return now }
	m.fail = false
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.operator) != 2 || m.operator[0] != m.operator[1] {
		t.Fatal("retry changed idempotency key")
	}
	j, _ = s.Store.Get(j.ID)
	if j.State != "ready" {
		t.Fatal("customer did not finish independently")
	}
}

func TestNotificationsPreserveManualAndRenewalAwarenessWithoutProvisioning(t *testing.T) {
	for _, reason := range []string{"subscription_create", "subscription_cycle", "subscription_update", "purchase"} {
		t.Run(reason, func(t *testing.T) {
			s, p, m := fixture(t)
			s.Config.AlertEmail = "operator@example.com"
			w := httptest.NewRecorder()
			s.Handler().ServeHTTP(w, signedRequest(s, "manual", paidPayload(s, reason, "agency-product", "agency-sub", s.now())))
			if w.Code != 202 {
				t.Fatal(w.Code)
			}
			if err := s.Tick(context.Background(), "worker"); err != nil {
				t.Fatal(err)
			}
			jobs, _ := s.Store.Jobs()
			if len(jobs) != 0 || p.calls != 0 || len(m.messages) != 1 || !strings.HasPrefix(m.messages[0], "operator@example.com\n") {
				t.Fatal("manual billing purchase lost notice or provisioned a server")
			}
		})
	}
	s, _, m := fixture(t)
	s.Config.AlertEmail = "operator@example.com"
	for _, valid := range []bool{true, false} {
		w := httptest.NewRecorder()
		r := signedRequest(s, "old", paidPayload(s, "subscription_create", "maker-product", "sub", s.Config.Cutover.Add(-time.Second)))
		if !valid {
			r.Header.Set("webhook-signature", "invalid")
		}
		s.Handler().ServeHTTP(w, r)
	}
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if len(m.messages) != 0 {
		t.Fatal("historical or unsigned event sent a notification")
	}
}

func TestNotificationReceiptAndSignupRollbackTogetherAndReadOnlyKeyCannotInspectQueue(t *testing.T) {
	s, _, _ := fixture(t)
	s.Config.AlertEmail = "operator@example.com"
	if _, err := s.Store.db.Exec("CREATE TRIGGER reject_notice BEFORE INSERT ON billing_notifications BEGIN SELECT RAISE(ABORT,'test'); END;"); err != nil {
		t.Fatal(err)
	}
	raw := paidPayload(s, "subscription_create", "maker-product", "sub", s.now())
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, signedRequest(s, "purchase", raw))
	if w.Code != 503 {
		t.Fatal(w.Code)
	}
	var count int
	s.Store.db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	jobs, _ := s.Store.Jobs()
	if count != 0 || len(jobs) != 0 {
		t.Fatal("partial billing receipt committed")
	}
	s.Store.db.Exec("DROP TRIGGER reject_notice")
	w = httptest.NewRecorder()
	s.Handler().ServeHTTP(w, signedRequest(s, "purchase", raw))
	if w.Code != 202 {
		t.Fatal(w.Code)
	}
	s.Config.MonitorToken = strings.Repeat("r", 32)
	for _, key := range []string{"", s.Config.MonitorToken, s.Config.OpsToken} {
		w = httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/ops/notifications", nil)
		r.Header.Set("Authorization", "Bearer "+key)
		s.Handler().ServeHTTP(w, r)
		if key == s.Config.OpsToken {
			if w.Code != 200 || strings.Contains(w.Body.String(), "customer@example.com") {
				t.Fatal("operator aggregate status incorrect")
			}
		} else if w.Code != 401 {
			t.Fatal("queue exposed to read-only or anonymous access")
		}
	}
	if _, err := s.Store.db.Exec("UPDATE billing_notifications SET attempts=3"); err != nil {
		t.Fatal(err)
	}
	unhealthy, err := s.Store.purchaseNotificationUnhealthy(s.now())
	if err != nil || !unhealthy {
		t.Fatal("failed notification not monitored")
	}
	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/ops/monitor", nil)
	r.Header.Set("Authorization", "Bearer "+s.Config.MonitorToken)
	s.Handler().ServeHTTP(w, r)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "billing_notification_pending") || strings.Contains(w.Body.String(), "customer@example.com") {
		t.Fatal("monitor did not report aggregate notification failure")
	}
}
