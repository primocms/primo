package internal

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const cliLoginLifetime = 5 * time.Minute
const cliLoginInterval = 2 * time.Second
const cliLoginCapacity = 1024

// Pending approvals intentionally live only for this server process. Restarting
// expires them; completed logins use normal PocketBase user tokens. Store only a
// digest of the CLI's secret. The public browser code cannot claim credentials.
type cliLoginRequest struct {
	code          string
	ip            string
	expires       time.Time
	nextPoll      time.Time
	approvalToken string
	denied        bool
}

type cliLoginStore struct {
	mu       sync.Mutex
	requests map[[32]byte]*cliLoginRequest
	now      func() time.Time
}

func newCLILoginStore() *cliLoginStore {
	return &cliLoginStore{requests: make(map[[32]byte]*cliLoginRequest), now: time.Now}
}

func cliLoginSecret(bytes int) (string, error) {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func cliLoginError(e *core.RequestEvent, status int, code, message string) error {
	e.Response.Header().Set("Cache-Control", "no-store")
	return e.JSON(status, map[string]any{"error": code, "message": message})
}

func RegisterCLILoginEndpoints(pb *pocketbase.PocketBase) error {
	return registerCLILoginEndpoints(pb, newCLILoginStore())
}

func registerCLILoginEndpoints(pb *pocketbase.PocketBase, store *cliLoginStore) error {
	pb.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.POST("/api/primo/cli-login/start", func(e *core.RequestEvent) error {
			store.mu.Lock()
			defer store.mu.Unlock()
			now := store.now()
			ip := e.RealIP()
			active := 0
			for key, request := range store.requests {
				if !now.Before(request.expires) {
					delete(store.requests, key)
				} else if request.ip == ip {
					active++
				}
			}
			if active >= 5 || len(store.requests) >= cliLoginCapacity {
				e.Response.Header().Set("Retry-After", "60")
				return cliLoginError(e, http.StatusTooManyRequests, "rate_limited", "Too many pending login requests. Wait for them to expire.")
			}
			secret, err := cliLoginSecret(32)
			if err != nil {
				return err
			}
			code, err := cliLoginSecret(8)
			if err != nil {
				return err
			}
			code = strings.ToUpper(code[:4] + "-" + code[4:8] + "-" + code[8:12] + "-" + code[12:])
			store.requests[sha256.Sum256([]byte(secret))] = &cliLoginRequest{code: code, ip: ip, expires: now.Add(cliLoginLifetime)}
			e.Response.Header().Set("Cache-Control", "no-store")
			return e.JSON(http.StatusOK, map[string]any{
				"protocol": 1, "device_code": secret, "user_code": code,
				"verification_uri": "/admin/cli-login?code=" + code,
				"expires_in":       int(cliLoginLifetime.Seconds()), "interval": int(cliLoginInterval.Seconds()),
			})
		})

		event.Router.POST("/api/primo/cli-login/approve", func(e *core.RequestEvent) error {
			// Normal user authentication is required even on localhost. Dev mode and
			// PocketBase superusers must not bypass consent or grant a users token.
			if e.Auth == nil || e.Auth.Collection().Name != "users" {
				return cliLoginError(e, http.StatusUnauthorized, "authentication_required", "Sign in to Primo before approving CLI access.")
			}
			var body struct {
				UserCode string `json:"user_code"`
				Action   string `json:"action"`
			}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request", nil)
			}
			if body.Action != "approve" && body.Action != "deny" {
				return e.BadRequestError("Choose approve or deny", nil)
			}
			store.mu.Lock()
			defer store.mu.Unlock()
			for _, request := range store.requests {
				if request.code != body.UserCode {
					continue
				}
				if !store.now().Before(request.expires) {
					return cliLoginError(e, http.StatusGone, "expired_token", "This login request expired. Start primo login again.")
				}
				if request.approvalToken != "" || request.denied {
					return cliLoginError(e, http.StatusConflict, "already_decided", "This request has already been approved or declined.")
				}
				if body.Action == "deny" {
					request.denied = true
				} else {
					// Hand off the already-authenticated browser session without minting a
					// token with a longer lifetime or bypassing MFA/impersonation limits.
					token := strings.TrimPrefix(e.Request.Header.Get("Authorization"), "Bearer ")
					if token == "" {
						return e.UnauthorizedError("Authorization header required", nil)
					}
					request.approvalToken = token
				}
				e.Response.Header().Set("Cache-Control", "no-store")
				return e.JSON(http.StatusOK, map[string]bool{"ok": true})
			}
			return cliLoginError(e, http.StatusNotFound, "invalid_request", "This login request is unavailable. Start primo login again.")
		})

		event.Router.POST("/api/primo/cli-login/token", func(e *core.RequestEvent) error {
			var body struct {
				DeviceCode string `json:"device_code"`
			}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request", nil)
			}
			key := sha256.Sum256([]byte(body.DeviceCode))
			store.mu.Lock()
			defer store.mu.Unlock()
			request := store.requests[key]
			if request == nil {
				return cliLoginError(e, http.StatusBadRequest, "invalid_request", "This login request is unavailable. Start primo login again.")
			}
			now := store.now()
			if !now.Before(request.expires) {
				delete(store.requests, key)
				return cliLoginError(e, http.StatusGone, "expired_token", "This login request expired. Start primo login again.")
			}
			if request.denied {
				delete(store.requests, key)
				return cliLoginError(e, http.StatusForbidden, "access_denied", "Browser approval was declined.")
			}
			if now.Before(request.nextPoll) {
				e.Response.Header().Set("Retry-After", "5")
				return cliLoginError(e, http.StatusTooManyRequests, "slow_down", "Wait before checking this login request again.")
			}
			request.nextPoll = now.Add(cliLoginInterval)
			if request.approvalToken == "" {
				return cliLoginError(e, http.StatusAccepted, "authorization_pending", "Waiting for browser approval.")
			}
			user, err := pb.FindAuthRecordByToken(request.approvalToken, core.TokenTypeAuth)
			if err != nil || user.Collection().Name != "users" {
				delete(store.requests, key)
				return cliLoginError(e, http.StatusForbidden, "access_denied", "The approving session is no longer valid. Sign in and start primo login again.")
			}
			// Consume before issuing the response: parallel polling cannot claim twice.
			delete(store.requests, key)
			e.Response.Header().Set("Cache-Control", "no-store")
			return e.JSON(http.StatusOK, map[string]any{"token": request.approvalToken, "record": map[string]string{"id": user.Id, "email": user.Email()}})
		})
		return event.Next()
	})
	return nil
}
