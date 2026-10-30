package hosting

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type Job struct {
	ID, Subscription, Order, Customer, Email     string
	Plan                                         Plan
	State, Slug, App, Volume, Machine            string
	ClaimHash, ClaimSecret, SessionHash, Secrets string
	ClaimExpires, SessionExpires, TokenExpires   int64
	NextAt, UpdatedAt                            int64
	Attempts                                     int
	Error                                        string
	Alerted                                      bool
	SecretsVersion                               uint64
	StartedAt                                    int64
	ReadyAt                                      int64
	Retired                                      bool
	SMTPKeyID                                    string
	DomainParentHash                             string
	DomainTokenUpdatedAt                         int64
	DomainRotation                               DomainRotation
	Suspension                                   Suspension
}

type Credentials struct{ Password, AdminPassword, DomainToken, SMTPPassword string }

type Store struct {
	db   *sql.DB
	aead cipher.AEAD
}

func OpenStore(filename string, key []byte) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	f.Close()
	if err := os.Chmod(filename, 0600); err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", filename)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db, aead: aead}
	_, err = db.Exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
		CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, subscription TEXT NOT NULL UNIQUE,
		 slug TEXT UNIQUE, state TEXT NOT NULL, next_at INTEGER NOT NULL, payload BLOB NOT NULL);
		CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, type TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS holds(subscription TEXT PRIMARY KEY);
		CREATE TABLE IF NOT EXISTS worker_lock(id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS backup_runs(target TEXT PRIMARY KEY, object_key TEXT NOT NULL, completed_at INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS credential_status(id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL);
		CREATE TABLE IF NOT EXISTS credential_alerts(key TEXT PRIMARY KEY, sent_at INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS suspensions(subscription TEXT PRIMARY KEY, after_at INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS worker_heartbeat(id INTEGER PRIMARY KEY CHECK(id=1), completed_at INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS billing_notifications(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
		 next_at INTEGER NOT NULL, attempts INTEGER NOT NULL, sent_at INTEGER NOT NULL, payload BLOB NOT NULL);`)
	if err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
func (s *Store) seal(id, text string) (string, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(s.aead.Seal(nonce, nonce, []byte(text), []byte(id))), nil
}
func (s *Store) open(id, text string) (string, error) {
	b, err := base64.StdEncoding.DecodeString(text)
	if err != nil || len(b) < s.aead.NonceSize() {
		return "", errors.New("invalid encrypted state")
	}
	n := s.aead.NonceSize()
	raw, err := s.aead.Open(nil, b[:n], b[n:], []byte(id))
	return string(raw), err
}
func (s *Store) encode(j Job) (string, error) {
	raw, err := json.Marshal(j)
	if err != nil {
		return "", err
	}
	return s.seal(j.ID, string(raw))
}
func (s *Store) decode(id, raw string) (Job, error) {
	var j Job
	text, err := s.open(id, raw)
	if err != nil {
		return j, err
	}
	err = json.Unmarshal([]byte(text), &j)
	return j, err
}

func (s *Store) Save(j Job) error {
	raw, err := s.encode(j)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("UPDATE jobs SET slug=NULLIF(?,''),state=?,next_at=?,payload=? WHERE id=?", j.Slug, j.State, j.NextAt, raw, j.ID)
	return err
}

func (s *Store) checkpoint(j Job, phase string) error {
	if phase == "invite" {
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		var current string
		if err := tx.QueryRow("SELECT payload FROM jobs WHERE id=?", j.ID).Scan(&current); err != nil {
			return err
		}
		latest, err := s.decode(j.ID, current)
		if err != nil {
			return err
		}
		if latest.State != phase || latest.ClaimHash != j.ClaimHash {
			return tx.Commit()
		}
		raw, err := s.encode(j)
		if err != nil {
			return err
		}
		if _, err := tx.Exec("UPDATE jobs SET state=?,next_at=?,payload=? WHERE id=?", j.State, j.NextAt, raw, j.ID); err != nil {
			return err
		}
		return tx.Commit()
	}
	raw, err := s.encode(j)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("UPDATE jobs SET slug=NULLIF(?,''),state=?,next_at=?,payload=? WHERE id=? AND state=?", j.Slug, j.State, j.NextAt, raw, j.ID, phase)
	return err
}

func (s *Store) Held(subscription string) (bool, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM holds WHERE subscription=?", subscription).Scan(&count)
	return count > 0, err
}
func (s *Store) Hold(eventID, eventType, subscription string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec("INSERT INTO events VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING", eventID, eventType, "billing_review", time.Now().Unix()); err != nil {
		return err
	}
	if _, err = tx.Exec("INSERT INTO holds VALUES(?) ON CONFLICT DO NOTHING", subscription); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) Get(id string) (Job, error) {
	var raw string
	if err := s.db.QueryRow("SELECT payload FROM jobs WHERE id=?", id).Scan(&raw); err != nil {
		return Job{}, err
	}
	return s.decode(id, raw)
}
func (s *Store) Jobs() ([]Job, error) {
	rows, err := s.db.Query("SELECT id,payload FROM jobs ORDER BY rowid")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var jobs []Job
	for rows.Next() {
		var id, raw string
		if err := rows.Scan(&id, &raw); err != nil {
			return nil, err
		}
		j, err := s.decode(id, raw)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// Receipt and job are committed together before acknowledging Polar. Both event and
// subscription have independent uniqueness constraints (redelivery IDs can differ).
func (s *Store) Accept(eventID, eventType, result string, j *Job) error {
	return s.accept(eventID, eventType, result, j, nil)
}

func (s *Store) accept(eventID, eventType, result string, j *Job, notice *BillingNotification) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	r, err := tx.Exec("INSERT INTO events VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING", eventID, eventType, result, time.Now().Unix())
	if err != nil {
		return err
	}
	n, err := r.RowsAffected()
	if err != nil {
		return err
	}
	if n > 0 && j != nil {
		raw, err := s.encode(*j)
		if err != nil {
			return err
		}
		_, err = tx.Exec("INSERT INTO jobs VALUES(?, ?, NULL, ?, ?, ?) ON CONFLICT(subscription) DO NOTHING", j.ID, j.Subscription, j.State, j.NextAt, raw)
		if err != nil {
			return err
		}
	}
	if n > 0 && notice != nil {
		raw, err := json.Marshal(notice)
		if err != nil {
			return err
		}
		sealed, err := s.seal("billing-notification:"+notice.ID, string(raw))
		if err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT INTO billing_notifications VALUES(?,?,?,?,0,?) ON CONFLICT(id) DO NOTHING", notice.ID, notice.CreatedAt, notice.CreatedAt, 0, sealed); err != nil {
			return err
		}
	}
	return tx.Commit()
}

var ErrClaim = errors.New("setup link is invalid, expired, or already used")
var ErrSlug = errors.New("that server name is unavailable")

func (s *Store) Claim(token, slug, password, session string, now time.Time) (Job, error) {
	// One connection serializes this transaction with receipts and worker checkpoints.
	tx, err := s.db.Begin()
	if err != nil {
		return Job{}, err
	}
	defer tx.Rollback()
	rows, err := tx.Query("SELECT id,payload FROM jobs WHERE state IN ('invite','awaiting_claim')")
	if err != nil {
		return Job{}, err
	}
	var chosen Job
	for rows.Next() {
		var id, raw string
		if err := rows.Scan(&id, &raw); err != nil {
			rows.Close()
			return Job{}, err
		}
		j, err := s.decode(id, raw)
		if err != nil {
			rows.Close()
			return Job{}, err
		}
		if j.ClaimHash == hashToken(token) && j.ClaimExpires > now.Unix() {
			chosen = j
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return Job{}, err
	}
	if chosen.ID == "" {
		return Job{}, ErrClaim
	}
	var owner string
	if err := tx.QueryRow("SELECT id FROM jobs WHERE slug=?", slug).Scan(&owner); err == nil {
		return Job{}, ErrSlug
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Job{}, err
	}
	admin, err := randomToken()
	if err != nil {
		return Job{}, err
	}
	creds, err := json.Marshal(Credentials{Password: password, AdminPassword: admin})
	if err != nil {
		return Job{}, err
	}
	chosen.Secrets, err = s.seal(chosen.ID+":credentials", string(creds))
	if err != nil {
		return Job{}, err
	}
	chosen.Slug, chosen.State, chosen.App = slug, "app", "primo-c-"+chosen.ID
	chosen.ClaimHash, chosen.ClaimSecret = "", ""
	chosen.SessionHash, chosen.SessionExpires = hashToken(session), now.Add(7*24*time.Hour).Unix()
	chosen.NextAt, chosen.UpdatedAt, chosen.Attempts, chosen.Error = now.Unix(), now.Unix(), 0, ""
	chosen.StartedAt = now.Unix()
	raw, err := s.encode(chosen)
	if err != nil {
		return Job{}, err
	}
	_, err = tx.Exec("UPDATE jobs SET slug=?,state=?,next_at=?,payload=? WHERE id=?", slug, chosen.State, chosen.NextAt, raw, chosen.ID)
	if err != nil {
		return Job{}, err
	}
	return chosen, tx.Commit()
}

// The lease is longer than a bounded external step; only one worker may mutate
// resources. A crashed process releases it after five minutes, without losing jobs.
func (s *Store) Lease(owner string, now time.Time) (bool, error) {
	r, err := s.db.Exec(`INSERT INTO worker_lock VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET
	 owner=excluded.owner,expires=excluded.expires WHERE worker_lock.owner=excluded.owner OR worker_lock.expires<?`, owner, now.Add(5*time.Minute).Unix(), now.Unix())
	if err != nil {
		return false, err
	}
	n, err := r.RowsAffected()
	return n == 1, err
}

func (s *Store) Release(owner string) { s.db.Exec("DELETE FROM worker_lock WHERE owner=?", owner) }
