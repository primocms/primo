package internal

import (
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

var importCapacityMu sync.Mutex

// Hold capacity through parsing, archive processing and the transaction. A
// completed staging read must not free its budget while queued in memory.
func acquireImportCapacity(app core.App, e *core.RequestEvent) (func(), error) {
	importCapacityMu.Lock()
	capacity, ok := app.Store().Get("primo.importCapacity").(chan struct{})
	if !ok {
		capacity = make(chan struct{}, 1)
		app.Store().Set("primo.importCapacity", capacity)
	}
	importCapacityMu.Unlock()
	select {
	case capacity <- struct{}{}:
		return func() { <-capacity }, nil
	default:
		e.Response.Header().Set("Retry-After", "1")
		return nil, e.TooManyRequestsError("Another archive import is running. Wait for it to finish before retrying.", nil)
	}
}
