package hosting

import (
	"fmt"
	"testing"
	"time"
)

func TestAppTokenExpiryCannotOutliveParent(t *testing.T) {
	now := time.Unix(1800000000, 0)
	parent := now.Add(30 * 24 * time.Hour).Unix()
	raw := []byte(fmt.Sprintf(`[{"caveats":[{"type":"Organization","body":{"id":1}}]},{"caveats":[{"type":"ValidityWindow","body":{"not_before":%d,"not_after":%d}}]}]`, now.Unix()-30, parent))
	got, err := parentTokenExpiry(raw, now)
	if err != nil || got != parent {
		t.Fatalf("expiry=%d err=%v", got, err)
	}
	for _, bad := range []string{`[]`, `[{"caveats":[]}]`, `[{"caveats":[{"type":"ValidityWindow","body":{}}]}]`, fmt.Sprintf(`[{"caveats":[{"type":"ValidityWindow","body":{"not_after":%d}}]}]`, now.Add(time.Minute).Unix()), fmt.Sprintf(`[{"caveats":[{"type":"ValidityWindow","body":{"not_before":%d,"not_after":%d}}]}]`, now.Add(time.Minute).Unix(), parent)} {
		if _, err := parentTokenExpiry([]byte(bad), now); err == nil {
			t.Fatal("accepted absent, expired or future validity")
		}
	}
}
