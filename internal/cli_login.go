package internal

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const cliLoginTTL = 10 * time.Minute

type cliLoginRequest struct {
	secret  string
	expires time.Time
	userID  string
}

type cliLoginStore struct {
	sync.Mutex
	requests map[string]*cliLoginRequest
}

func cliLoginRandom() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

// Requests are temporary, bounded, and specific to this running instance.
// A restart cancels pending requests. Only the initiating CLI has the poll secret.
func RegisterCLILoginEndpoints(pb *pocketbase.PocketBase) error {
	return registerCLILoginEndpoints(pb, time.Now)
}

func registerCLILoginEndpoints(pb *pocketbase.PocketBase, now func() time.Time) error {
	store := &cliLoginStore{requests: make(map[string]*cliLoginRequest)}
	pb.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.POST("/api/primo/cli-login", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Cache-Control", "no-store")
			code, err := cliLoginRandom()
			if err != nil {
				return e.InternalServerError("Could not create login request", err)
			}
			secret, err := cliLoginRandom()
			if err != nil {
				return e.InternalServerError("Could not create login request", err)
			}
			store.Lock()
			defer store.Unlock()
			for key, request := range store.requests {
				if now().After(request.expires) {
					delete(store.requests, key)
				}
			}
			if len(store.requests) >= 100 {
				return e.TooManyRequestsError("Too many pending login requests. Try again later.", nil)
			}
			expires := now().Add(cliLoginTTL)
			store.requests[code] = &cliLoginRequest{secret: secret, expires: expires}
			return e.JSON(200, map[string]any{"code": code, "secret": secret, "expires_at": expires.UTC().Format(time.RFC3339)})
		})
		event.Router.POST("/api/primo/cli-login/approve", func(e *core.RequestEvent) error {
			if e.Auth == nil || e.Auth.Collection().Name != "users" {
				return e.UnauthorizedError("Sign in to authorize your CLI", nil)
			}
			body := struct {
				Code string `json:"code"`
			}{}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid login request", err)
			}
			store.Lock()
			defer store.Unlock()
			request := store.requests[body.Code]
			if request == nil || now().After(request.expires) {
				return e.BadRequestError("Login request expired. Ask your agent to start again.", nil)
			}
			if request.userID != "" {
				return e.BadRequestError("Login request has already been authorized", nil)
			}
			request.userID = e.Auth.Id
			return e.JSON(200, map[string]any{"state": "approved"})
		})
		event.Router.POST("/api/primo/cli-login/check", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Cache-Control", "no-store")
			body := struct {
				Code   string `json:"code"`
				Secret string `json:"secret"`
			}{}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid login request", err)
			}
			store.Lock()
			defer store.Unlock()
			request := store.requests[body.Code]
			if request == nil || now().After(request.expires) || subtle.ConstantTimeCompare([]byte(request.secret), []byte(body.Secret)) != 1 {
				return e.BadRequestError("Login request expired or invalid. Start a new browser login.", nil)
			}
			if request.userID == "" {
				return e.JSON(200, map[string]any{"state": "pending"})
			}
			user, err := pb.FindRecordById("users", request.userID)
			if err != nil {
				delete(store.requests, body.Code)
				return e.BadRequestError("Account is unavailable", nil)
			}
			token, err := user.NewAuthToken()
			if err != nil {
				return e.InternalServerError("Could not authorize CLI", err)
			}
			delete(store.requests, body.Code)
			return e.JSON(200, map[string]any{"state": "authenticated", "token": token})
		})
		return event.Next()
	})
	return nil
}
