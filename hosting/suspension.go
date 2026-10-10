package hosting

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"
)

// SavedConfig is inside the encrypted job payload, retained for a reviewed manual
// restoration. Suspension never deletes apps, volumes, DNS records or archives.
type Suspension struct {
	Phase               string
	SavedConfig         map[string]any
	CompletedAt, NextAt int64
	Attempts            int
	Error               string
}

type CustomerSuspender interface {
	SuspendCustomer(context.Context, *Job) error
}

func (s *Store) Revoke(eventID, subscription string, after int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	r, err := tx.Exec("INSERT INTO events VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING", eventID, "subscription.revoked", "suspend_after_paid_period", time.Now().Unix())
	if err != nil {
		return err
	}
	n, err := r.RowsAffected()
	if err != nil {
		return err
	}
	if n > 0 {
		if _, err = tx.Exec("INSERT INTO holds VALUES(?) ON CONFLICT DO NOTHING", subscription); err != nil {
			return err
		}
		// Redeliveries cannot shorten paid access or postpone an existing deadline.
		if _, err = tx.Exec("INSERT INTO suspensions VALUES(?,?) ON CONFLICT DO NOTHING", subscription, after); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (s *Store) SuspendAfter(subscription string) (int64, error) {
	var at int64
	err := s.db.QueryRow("SELECT after_at FROM suspensions WHERE subscription=?", subscription).Scan(&at)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return at, err
}

func (s *Service) suspendIfDue(ctx context.Context, owner string, j *Job) error {
	at, err := s.Store.SuspendAfter(j.Subscription)
	if err != nil || at == 0 || at > s.now().Unix() || j.Suspension.CompletedAt > 0 || j.Suspension.NextAt > s.now().Unix() {
		return err
	}
	if j.Machine == "" {
		return nil
	} // An unclaimed/unfinished purchase stays held.
	ok, err := s.Store.Lease(owner, s.now())
	if err != nil || !ok {
		return err
	}
	if j.Suspension.Phase == "" {
		j.Suspension.Phase = "capture"
		if err := s.Store.Save(*j); err != nil {
			return err
		}
	}
	stepCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if s.Suspender == nil {
		err = errors.New("suspension adapter unavailable")
	} else {
		err = s.Suspender.SuspendCustomer(stepCtx, j)
	}
	if err != nil {
		j.Suspension.Attempts++
		j.Suspension.Error = "suspension_failed"
		j.Suspension.NextAt = s.now().Add(time.Duration(1<<min(j.Suspension.Attempts, 8)) * 5 * time.Second).Unix()
	} else {
		j.Suspension.Error, j.Suspension.Attempts = "", 0
		j.Suspension.NextAt = s.now().Unix()
		if j.Suspension.Phase == "complete" {
			j.Suspension.CompletedAt = s.now().Unix()
		}
	}
	return s.Store.Save(*j)
}

func suspensionConfig(config map[string]any) bool {
	services, ok := config["services"].([]any)
	restart, _ := config["restart"].(map[string]any)
	// Fly omits the services field when no routes are registered.
	return (config["services"] == nil || (ok && len(services) == 0)) && restart["policy"] == "no"
}

func (p *FlyProvisioner) SuspendCustomer(ctx context.Context, j *Job) error {
	if j.Retired || len(j.ID) != 24 || j.App != "primo-c-"+j.ID || j.Machine == "" || j.Volume == "" {
		return errors.New("invalid suspension target")
	}
	path := appPath(j) + "/machines/" + j.Machine
	m, err := p.customerMachine(ctx, j)
	if err != nil {
		return err
	}
	switch j.Suspension.Phase {
	case "capture":
		// Commit the original configuration before any external mutation.
		j.Suspension.SavedConfig = m.Config
		j.Suspension.Phase = "isolate"
		return nil
	case "isolate", "stop", "verify":
		if j.Suspension.SavedConfig == nil {
			return errors.New("saved suspension config missing")
		}
	default:
		return errors.New("invalid suspension phase")
	}
	var lease struct {
		Data struct {
			Nonce string `json:"nonce"`
		} `json:"data"`
	}
	if err := p.fly(ctx, "POST", path+"/lease", map[string]any{"description": "Primo retain data after subscription ends", "ttl": 150}, &lease); err != nil {
		return err
	}
	if lease.Data.Nonce == "" {
		return errors.New("suspension lease missing")
	}
	headers := map[string]string{"fly-machine-lease-nonce": lease.Data.Nonce}
	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		requestHeaders(releaseCtx, p.Client, http.MethodDelete, p.FlyEndpoint+path+"/lease", p.Config.FlyToken, headers, nil, nil)
	}()
	m, err = p.customerMachine(ctx, j)
	if err != nil {
		return err
	}
	if m.State != "started" && m.State != "stopped" && m.State != "created" {
		return errors.New("suspension Machine transitioning")
	}
	switch j.Suspension.Phase {
	case "isolate":
		if !suspensionConfig(m.Config) {
			m.Config["services"] = []any{} // No proxy route can wake a suspended server.
			m.Config["restart"] = map[string]any{"policy": "no"}
			if err := requestHeaders(ctx, p.Client, http.MethodPost, p.FlyEndpoint+path, p.Config.FlyToken, headers, map[string]any{"config": m.Config, "current_version": m.InstanceID, "skip_launch": true}, nil); err != nil {
				return err
			}
		}
		j.Suspension.Phase = "stop"
	case "stop":
		if !suspensionConfig(m.Config) {
			j.Suspension.Phase = "isolate"
			return nil
		}
		if m.State == "started" {
			if err := requestHeaders(ctx, p.Client, http.MethodPost, p.FlyEndpoint+path+"/stop", p.Config.FlyToken, headers, map[string]any{"signal": "SIGTERM", "timeout": "30s"}, nil); err != nil {
				return err
			}
		}
		j.Suspension.Phase = "verify"
	case "verify":
		if !suspensionConfig(m.Config) {
			j.Suspension.Phase = "isolate"
			return nil
		}
		if m.State == "started" {
			j.Suspension.Phase = "stop"
			return nil
		}
		j.Suspension.Phase = "complete"
	}
	return nil
}
