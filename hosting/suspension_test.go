package hosting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fakeSuspender struct {
	calls int
	fail  bool
}

func (p *fakeSuspender) SuspendCustomer(_ context.Context, j *Job) error {
	p.calls++
	if p.fail {
		return errors.New("sensitive response")
	}
	if j.Suspension.Phase == "capture" {
		j.Suspension.SavedConfig = map[string]any{"image": "preserved"}
		j.Suspension.Phase = "stop"
	} else {
		j.Suspension.Phase = "complete"
	}
	return nil
}
func billingEvent(t *testing.T, s *Service, id, kind string, end time.Time) {
	t.Helper()
	raw, _ := json.Marshal(map[string]any{"type": kind, "data": map[string]any{"id": "subscription-1", "subscription_id": "subscription-1", "current_period_end": end}})
	out := httptest.NewRecorder()
	s.Handler().ServeHTTP(out, signedRequest(s, id, raw))
	if out.Code != 202 {
		t.Fatal(out.Code)
	}
}
func TestCancellationRetainsPaidAccessAndSuspensionSurvivesRestart(t *testing.T) {
	s, _, _ := fixture(t)
	j := enqueue(t, s)
	j.State = "ready"
	j.Machine = "machine"
	s.Store.Save(j)
	p := &fakeSuspender{}
	s.Suspender = p
	billingEvent(t, s, "cancel", "subscription.canceled", s.now().Add(time.Hour))
	billingEvent(t, s, "uncancel", "subscription.uncanceled", s.now().Add(time.Hour))
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	if p.calls != 0 {
		t.Fatal("ordinary cancellation ended paid access")
	}
	end := s.now().Add(time.Hour)
	billingEvent(t, s, "revoke", "subscription.revoked", end)
	s.Tick(context.Background(), "worker")
	if p.calls != 0 {
		t.Fatal("terminal event shortened paid period")
	}
	now := end.Add(time.Second)
	s.Now = func() time.Time { return now }
	p.fail = true
	s.Tick(context.Background(), "worker")
	saved, _ := s.Store.Get(j.ID)
	if saved.Suspension.Phase != "capture" || saved.Suspension.Attempts != 1 || strings.Contains(saved.Suspension.Error, "sensitive") {
		t.Fatal("failed step not retained safely")
	}
	billingEvent(t, s, "revoke", "subscription.revoked", now.Add(24*time.Hour))
	billingEvent(t, s, "redelivery", "subscription.revoked", now.Add(24*time.Hour))
	after, _ := s.Store.SuspendAfter(j.Subscription)
	if after != end.Unix() {
		t.Fatal("redelivery postponed suspension")
	}
	filename := filepath.Join(t.TempDir(), "restarted.sqlite")
	// Recover the database and its durable terminal request, not just a Job copy.
	if _, err := s.Store.db.ExecContext(context.Background(), "VACUUM INTO ?", filename); err != nil {
		t.Fatal(err)
	}
	restarted, err := OpenStore(filename, bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	s.Store = restarted
	p.fail = false
	now = now.Add(time.Minute)
	s.Tick(context.Background(), "worker")
	s.Tick(context.Background(), "worker")
	saved, _ = s.Store.Get(j.ID)
	if saved.Suspension.CompletedAt == 0 || saved.State != "ready" || saved.Suspension.SavedConfig["image"] != "preserved" {
		t.Fatal("suspension not completed with retained state")
	}
	before := p.calls
	s.Tick(context.Background(), "worker")
	if p.calls != before {
		t.Fatal("repeated terminal event repeated effects")
	}
}

func TestRefundStaysManualAndNeverAutomaticallySuspends(t *testing.T) {
	s, _, _ := fixture(t)
	j := enqueue(t, s)
	j.State = "ready"
	j.Machine = "machine"
	s.Store.Save(j)
	p := &fakeSuspender{}
	s.Suspender = p
	billingEvent(t, s, "partial-refund", "order.refunded", s.now())
	if err := s.Tick(context.Background(), "worker"); err != nil {
		t.Fatal(err)
	}
	held, _ := s.Store.Held(j.Subscription)
	after, _ := s.Store.SuspendAfter(j.Subscription)
	if !held || after != 0 || p.calls != 0 {
		t.Fatal("refund ended access automatically")
	}
}
func TestFlySuspensionReconcilesLostResponsesWithoutDeletingData(t *testing.T) {
	for _, stopped := range []bool{false, true} {
		t.Run(fmtBool(stopped), func(t *testing.T) {
			id := strings.Repeat("c", 24)
			j := Job{ID: id, App: "primo-c-" + id, Machine: "m", Volume: "v", Suspension: Suspension{Phase: "capture"}}
			state := "started"
			if stopped {
				state = "stopped"
			}
			config := map[string]any{"image": "kept", "env": map[string]string{"PRIMO_HOSTED_MODE": "true", "PRIMO_DOMAIN_PROVIDER": "fly"}, "mounts": []map[string]string{{"volume": "v", "path": "/app/pb_data"}}, "services": []any{map[string]any{"autostart": true}}, "restart": map[string]any{"policy": "always"}, "metadata": map[string]any{"preserved": "yes"}}
			updates, stops := 0, 0
			p := &FlyProvisioner{Config: Config{FlyToken: "parent"}, FlyEndpoint: "https://machine.test", Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				out := httptest.NewRecorder()
				path := "/apps/" + j.App + "/machines/m"
				switch {
				case r.URL.Path == path+"/lease":
					if r.Method == "POST" {
						out.Write([]byte(`{"data":{"nonce":"lease"}}`))
					} else if r.Method == "DELETE" {
						out.Write([]byte(`{}`))
					} else {
						t.Fatal("unexpected lease method")
					}
				case r.URL.Path == path && r.Method == "GET":
					json.NewEncoder(out).Encode(machine{ID: "m", Name: "primo-" + id, InstanceID: "version", State: state, Config: config})
				case r.URL.Path == path && r.Method == "POST":
					if r.Header.Get("fly-machine-lease-nonce") != "lease" {
						t.Fatal("missing lease")
					}
					var body map[string]any
					json.NewDecoder(r.Body).Decode(&body)
					if body["current_version"] != "version" || body["skip_launch"] != true {
						t.Fatal("update lacks version or can start stopped server")
					}
					config = body["config"].(map[string]any)
					updates++
					if config["image"] != "kept" || config["metadata"].(map[string]any)["preserved"] != "yes" {
						t.Fatal("lost customer configuration")
					}
					if !suspensionConfig(config) {
						t.Fatal("routes/restart still active")
					}
					delete(config, "services") // Fly normalizes empty services to omission.
					http.Error(out, "lost response", 503)
				case r.URL.Path == path+"/stop" && r.Method == "POST":
					stops++
					state = "stopped"
					http.Error(out, "lost stop response", 503)
				default:
					t.Fatalf("unexpected mutation %s %s", r.Method, r.URL.Path)
				}
				return out.Result(), nil
			})}}
			for i := 0; i < 8 && j.Suspension.Phase != "complete"; i++ {
				p.SuspendCustomer(context.Background(), &j)
			}
			if j.Suspension.Phase != "complete" || updates != 1 || j.Suspension.SavedConfig["image"] != "kept" || j.Suspension.SavedConfig["restart"].(map[string]any)["policy"] != "always" {
				t.Fatal("lost response not reconciled or original config overwritten")
			}
			if stopped && stops != 0 || !stopped && stops != 1 {
				t.Fatal("stop not idempotent")
			}
		})
	}
}
