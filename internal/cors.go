package internal

import (
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterCORS adds CORS headers based on the CORS_ALLOWED_ORIGINS env var.
//
//	unset or empty → no CORS headers (same-origin only, safest default)
//	"*"            → wildcard origin, no credentials (public marketplace mode)
//	"a.com,b.com"  → echo origin if it matches, allow credentials (dashboard mode)
func RegisterCORS(pb *pocketbase.PocketBase) error {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if raw == "" {
		return nil
	}

	wildcard := raw == "*"
	var allowed map[string]bool
	if !wildcard {
		allowed = map[string]bool{}
		for _, origin := range strings.Split(raw, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				allowed[origin] = true
			}
		}
	}

	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.BindFunc(func(e *core.RequestEvent) error {
			origin := e.Request.Header.Get("Origin")
			if origin == "" {
				return e.Next()
			}

			h := e.Response.Header()
			if wildcard {
				h.Set("Access-Control-Allow-Origin", "*")
			} else if allowed[origin] {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Vary", "Origin")
				h.Set("Access-Control-Allow-Credentials", "true")
			} else {
				return e.Next()
			}

			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			reqHeaders := e.Request.Header.Get("Access-Control-Request-Headers")
			if reqHeaders != "" {
				h.Set("Access-Control-Allow-Headers", reqHeaders)
			} else {
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			}
			h.Set("Access-Control-Max-Age", "86400")

			if e.Request.Method == http.MethodOptions {
				e.Response.WriteHeader(http.StatusNoContent)
				return nil
			}

			return e.Next()
		})

		return serveEvent.Next()
	})

	return nil
}
