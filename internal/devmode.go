package internal

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// DevMode indicates if the server is running in development mode
var DevMode = false

// FileChange represents a file change event
type FileChange struct {
	File      string `json:"file"`
	Timestamp int64  `json:"timestamp"`
	Direction string `json:"direction"` // "push" or "pull"
}

// DevStatus represents the current dev status
type DevStatus struct {
	Type      string       `json:"type"`
	Status    string       `json:"status"`
	Message   string       `json:"message,omitempty"`
	Timestamp int64        `json:"timestamp"`
	Files     []FileChange `json:"files"`
}

// wsClient owns its websocket.Conn and serializes all writes through send.
// gorilla/websocket requires that only one goroutine call WriteMessage on a
// given connection; broadcasts, pings, and the initial status push all
// funnel through send so writePump is the sole writer.
type wsClient struct {
	conn   *websocket.Conn
	send   chan []byte
	closed chan struct{}
}

var (
	recentChanges   []FileChange
	recentChangesMu sync.RWMutex
	wsClients       = make(map[*wsClient]bool)
	wsClientsMu     sync.RWMutex
	upgrader        = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in dev mode
		},
	}
)

const (
	maxRecentChanges = 10
	// WebSocket timeouts
	writeWait      = 5 * time.Second
	pongWait       = 30 * time.Second
	pingPeriod     = (pongWait * 9) / 10 // Must be less than pongWait
	maxMessageSize = 512
	// Per-connection outbound buffer. Slow clients are dropped rather than
	// blocking broadcasts.
	sendBufferSize = 16
)

func init() {
	if os.Getenv("PRIMO_DEV_MODE") == "1" {
		DevMode = true
	}
}

// AddFileChange records a file change event
func AddFileChange(file string, direction string) {
	recentChangesMu.Lock()
	defer recentChangesMu.Unlock()

	change := FileChange{
		File:      file,
		Timestamp: time.Now().UnixMilli(),
		Direction: direction,
	}

	recentChanges = append([]FileChange{change}, recentChanges...)
	if len(recentChanges) > maxRecentChanges {
		recentChanges = recentChanges[:maxRecentChanges]
	}
}

// BroadcastStatus sends a status update to all connected WebSocket clients
func BroadcastStatus(status string, message string) {
	if !DevMode {
		return
	}

	recentChangesMu.RLock()
	files := make([]FileChange, len(recentChanges))
	copy(files, recentChanges)
	recentChangesMu.RUnlock()

	statusMsg := DevStatus{
		Type:      "status",
		Status:    status,
		Message:   message,
		Timestamp: time.Now().UnixMilli(),
		Files:     files,
	}

	data, err := json.Marshal(statusMsg)
	if err != nil {
		return
	}

	broadcast(data)
}

// BroadcastReload asks connected dev clients to reload the page.
func BroadcastReload() {
	if !DevMode {
		return
	}

	payload := map[string]string{
		"type": "reload",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	broadcast(data)
}

// broadcast fans data out to every connected client's send channel. Clients
// whose buffers are full are marked dead and torn down by writePump; we never
// block on a slow consumer here.
func broadcast(data []byte) {
	var dead []*wsClient

	wsClientsMu.RLock()
	for client := range wsClients {
		select {
		case client.send <- data:
		default:
			dead = append(dead, client)
		}
	}
	wsClientsMu.RUnlock()

	for _, client := range dead {
		closeClient(client)
	}
}

// closeClient is safe to call multiple times. It closes the closed channel,
// which signals writePump to exit and tear down the connection.
func closeClient(client *wsClient) {
	wsClientsMu.Lock()
	if _, ok := wsClients[client]; ok {
		delete(wsClients, client)
	}
	wsClientsMu.Unlock()

	select {
	case <-client.closed:
		// already closed
	default:
		close(client.closed)
	}
}

// writePump is the sole writer for client.conn. Following the gorilla chat
// example it owns the ticker for ping frames and consumes the send channel
// for text frames, so no other goroutine ever calls WriteMessage on this
// connection.
func writePump(client *wsClient) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		client.conn.Close()
	}()

	for {
		select {
		case data, ok := <-client.send:
			if !ok {
				return
			}
			client.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := client.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				closeClient(client)
				return
			}
		case <-ticker.C:
			client.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				closeClient(client)
				return
			}
		case <-client.closed:
			return
		}
	}
}

// readPump just drives pong handling and detects disconnection — we don't
// process incoming messages on the dev WS.
func readPump(client *wsClient) {
	defer closeClient(client)

	for {
		if _, _, err := client.conn.ReadMessage(); err != nil {
			return
		}
	}
}

// RegisterDevMode sets up the dev mode WebSocket endpoint
func RegisterDevMode(pb *pocketbase.PocketBase) error {
	if !DevMode {
		return nil
	}

	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/primo/dev/reload", func(e *core.RequestEvent) error {
			if !IsLocalhost(e) {
				return e.ForbiddenError("Localhost only", nil)
			}

			BroadcastReload()
			return e.NoContent(http.StatusNoContent)
		})

		// WebSocket endpoint for dev indicator
		serveEvent.Router.GET("/__pala_dev_ws__", func(e *core.RequestEvent) error {
			if !IsLocalhost(e) {
				return e.ForbiddenError("Localhost only", nil)
			}

			conn, err := upgrader.Upgrade(e.Response, e.Request, nil)
			if err != nil {
				return err
			}

			conn.SetReadLimit(maxMessageSize)
			conn.SetReadDeadline(time.Now().Add(pongWait))
			conn.SetPongHandler(func(string) error {
				conn.SetReadDeadline(time.Now().Add(pongWait))
				return nil
			})

			client := &wsClient{
				conn:   conn,
				send:   make(chan []byte, sendBufferSize),
				closed: make(chan struct{}),
			}

			wsClientsMu.Lock()
			wsClients[client] = true
			wsClientsMu.Unlock()

			// Queue the initial connected status before starting the pumps
			// so it lands before any broadcast that might race with it.
			recentChangesMu.RLock()
			files := make([]FileChange, len(recentChanges))
			copy(files, recentChanges)
			recentChangesMu.RUnlock()

			initial, _ := json.Marshal(DevStatus{
				Type:      "status",
				Status:    "connected",
				Timestamp: time.Now().UnixMilli(),
				Files:     files,
			})
			client.send <- initial

			go writePump(client)
			go readPump(client)

			return nil
		})

		return serveEvent.Next()
	})

	return nil
}

// DevIndicatorScript is the JavaScript injected into HTML pages in dev mode
const DevIndicatorScript = `
<script>
(function() {
  const INDICATOR_ID = '__primo_dev_indicator__';
  if (document.getElementById(INDICATOR_ID)) return;

  const style = document.createElement('style');
  style.textContent = ` + "`" + `
    #__primo_dev_indicator__ {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: rgba(255,255,255,0.9);
      user-select: none;
      border-radius: 4px;
      margin-left: 8px;
    }
    #__primo_dev_indicator__ .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: background 0.2s ease;
      flex-shrink: 0;
    }
    #__primo_dev_indicator__ .dot.connected { background: #22c55e; }
    #__primo_dev_indicator__ .dot.syncing { background: #eab308; animation: __primo_pulse 1s infinite; }
    #__primo_dev_indicator__ .dot.pushing { background: #3b82f6; animation: __primo_pulse 0.5s infinite; }
    #__primo_dev_indicator__ .dot.error { background: #ef4444; }
    #__primo_dev_indicator__ .dot.disconnected { background: #6b7280; }
    #__primo_dev_indicator__ .label {
      white-space: nowrap;
    }
    @keyframes __primo_pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }
    #__primo_dev_indicator__.floating {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      padding: 6px 12px;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
  ` + "`" + `;
  document.head.appendChild(style);

  const indicator = document.createElement('div');
  indicator.id = INDICATOR_ID;
  indicator.innerHTML = ` + "`" + `
    <span class="dot disconnected"></span>
    <span class="label">Connecting...</span>
  ` + "`" + `;

  let injected = false;

  function tryInjectIntoSlot() {
    if (injected) return true;

    // Look for the dedicated slot first
    const slot = document.getElementById('primo-dev-indicator-slot');
    if (slot) {
      slot.appendChild(indicator);
      injected = true;
      return true;
    }
    return false;
  }

  function injectFloating() {
    if (injected) return;
    indicator.classList.add('floating');
    document.body.appendChild(indicator);
    injected = true;
  }

  // Try to inject into slot, use MutationObserver for SPA
  function init() {
    if (tryInjectIntoSlot()) return;

    // Set up observer for dynamically rendered slot
    const observer = new MutationObserver(() => {
      if (tryInjectIntoSlot()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback to floating after 3 seconds if slot not found
    setTimeout(() => {
      if (!injected) {
        observer.disconnect();
        injectFloating();
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const dot = indicator.querySelector('.dot');
  const label = indicator.querySelector('.label');
  let reconnectTimer = null;
  let ws = null;

  function connect() {
    const wsScheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = wsScheme + location.host + '/__pala_dev_ws__';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      dot.className = 'dot connected';
      label.textContent = 'Dev';
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          dot.className = 'dot ' + data.status;
          switch (data.status) {
            case 'connected':
              label.textContent = 'Dev';
              break;
            case 'syncing':
              label.textContent = 'Syncing...';
              break;
            case 'pushing':
              label.textContent = 'Pushing...';
              break;
            case 'error':
              label.textContent = data.message || 'Error';
              break;
          }
        } else if (data.type === 'reload') {
          location.reload();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      dot.className = 'dot disconnected';
      label.textContent = 'Disconnected';
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  connect();
})();
</script>
`

// InjectDevIndicator injects the dev indicator script into HTML content
func InjectDevIndicator(content []byte) []byte {
	if !DevMode {
		return content
	}

	html := string(content)

	// Inject before </body> if present
	if strings.Contains(html, "</body>") {
		html = strings.Replace(html, "</body>", DevIndicatorScript+"</body>", 1)
	} else {
		html += DevIndicatorScript
	}

	return []byte(html)
}

// ServeHTMLWithDevIndicator wraps content serving to inject the dev indicator
func ServeHTMLWithDevIndicator(w http.ResponseWriter, r *http.Request, name string, modTime time.Time, reader io.ReadSeeker) {
	if !DevMode || !strings.HasSuffix(strings.ToLower(name), ".html") {
		http.ServeContent(w, r, name, modTime, reader)
		return
	}

	// Read the content
	content, err := io.ReadAll(reader)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Inject dev indicator
	modified := InjectDevIndicator(content)

	// Serve the modified content
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(modified)
}
