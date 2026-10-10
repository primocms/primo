package hosting

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/mail"
	"time"
)

// Receipt, optional signup, and operator notification commit together. A hashed
// order ID deduplicates deliveries with different event IDs; customer details
// remain encrypted. Existing receipts are never backfilled on deployment.
type BillingNotification struct {
	ID, Order, Email, Product, Reason, Plan, Action string
	CreatedAt                                       int64
}

func (s *Service) purchaseNotification(event paidEvent, result string) *BillingNotification {
	d := event.Data
	if s.Config.AlertEmail == "" || event.Type != "order.paid" || !d.Paid || d.CreatedAt.IsZero() || d.CreatedAt.Before(s.Config.Cutover) || d.ID == "" {
		return nil
	}
	address, err := mail.ParseAddress(d.Customer.Email)
	if err != nil || address.Address != d.Customer.Email || d.CustomerID == "" || d.Customer.ID != d.CustomerID {
		return nil
	}
	action := "Manual review/setup required; no server was provisioned."
	if result == "queued" {
		action = "Automatic setup invitation queued; the purchaser chooses a server name and password."
	}
	if d.BillingReason == "subscription_cycle" || d.BillingReason == "subscription_update" {
		action = "Existing subscription payment; no new server will be provisioned. Plan changes remain manual."
	}
	return &BillingNotification{ID: hashToken(d.ID), Order: d.ID, Email: d.Customer.Email, Product: d.ProductID, Reason: d.BillingReason, Plan: s.Config.Products[d.ProductID].Name, Action: action, CreatedAt: s.now().Unix()}
}

// At most one bounded email per tick, after customer provisioning. Delivery
// failures checkpoint a retry and do not turn a customer job into a failure.
func (s *Service) deliverPurchaseNotification(ctx context.Context) error {
	if s.Config.AlertEmail == "" {
		return nil
	}
	var id, raw string
	var attempts int
	err := s.Store.db.QueryRow("SELECT id,payload,attempts FROM billing_notifications WHERE sent_at=0 AND next_at<=? ORDER BY created_at,id LIMIT 1", s.now().Unix()).Scan(&id, &raw, &attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	text, err := s.Store.open("billing-notification:"+id, raw)
	if err != nil {
		return err
	}
	var notice BillingNotification
	if err := json.Unmarshal([]byte(text), &notice); err != nil {
		return err
	}
	subject := "Primo payment received"
	if notice.Reason == "subscription_create" {
		subject = "New Primo purchase"
	}
	if notice.Reason == "subscription_cycle" {
		subject = "Primo renewal received"
	}
	body := "Purchaser: " + notice.Email + "\nOrder: " + notice.Order + "\nProduct: " + notice.Product + "\n"
	if notice.Plan != "" {
		body += "Plan: " + notice.Plan + "\n"
	}
	body += "Billing reason: " + notice.Reason + "\n\n" + notice.Action
	mailCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	err = s.Mailer.Send(mailCtx, s.Config.AlertEmail, subject, body, "primo-purchase-"+id)
	cancel()
	if err == nil {
		_, err = s.Store.db.Exec("UPDATE billing_notifications SET sent_at=?,attempts=0 WHERE id=? AND sent_at=0", s.now().Unix(), id)
		return err
	}
	attempts++
	delay := min(time.Hour, time.Duration(1<<min(attempts, 10))*5*time.Second)
	_, err = s.Store.db.Exec("UPDATE billing_notifications SET attempts=?,next_at=? WHERE id=? AND sent_at=0", attempts, s.now().Add(delay).Unix(), id)
	return err
}

func (s *Service) notificationStatus(w http.ResponseWriter, r *http.Request) {
	if s.Config.OpsToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Config.OpsToken)) != 1 {
		http.Error(w, "unauthorized", 401)
		return
	}
	var pending, delivered int
	err := s.Store.db.QueryRow("SELECT COUNT(*) FILTER (WHERE sent_at=0), COUNT(*) FILTER (WHERE sent_at>0) FROM billing_notifications").Scan(&pending, &delivered)
	if err != nil {
		http.Error(w, "notification state unavailable", 503)
		return
	}
	jsonResponse(w, 200, map[string]any{"pending": pending, "delivered": delivered})
}

// Keep the monitor response aggregate: no purchaser, order, product or body.
func (s *Store) purchaseNotificationUnhealthy(now time.Time) (bool, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM billing_notifications WHERE sent_at=0 AND (attempts>=3 OR created_at<?)", now.Add(-15*time.Minute).Unix()).Scan(&count)
	return count > 0, err
}
