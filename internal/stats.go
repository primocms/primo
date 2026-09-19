/**
 * Primo CMS Usage Statistics
 *
 * This module sends a daily anonymous instance heartbeat (record counts only,
 * no content) to help gauge deployment health. It is separate from the
 * in-app product analytics (see src/lib/analytics.ts), which tracks specific
 * editor/publish operations from the client.
 *
 * What we collect:
 * - Anonymous instance ID (random UUID, not linked to any personal data)
 * - Primo CMS version number
 * - Count of sites, pages, and users (numbers only, no content)
 *
 * What we DON'T collect:
 * - Email addresses or usernames
 * - Site content, URLs, or custom code
 * - Any personally identifiable information
 *
 * Self-hosted instances: OFF by default. Opt in with PRIMO_ENABLE_USAGE_STATS=true.
 * Hosted mode (PRIMO_HOSTED_MODE=true): ON by default. Opt out with PRIMO_ENABLE_USAGE_STATS=false.
 */

package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type instanceStats struct {
	SitesCount int64 `json:"sites_count"`
	PagesCount int64 `json:"pages_count"`
	UsersCount int64 `json:"users_count"`
}

type event struct {
	ApiKey     string `json:"api_key"`
	Event      string `json:"event"`
	DistinctId string `json:"distinct_id"`
	Properties any    `json:"properties"`
	Timestamp  string `json:"timestamp"`
}

// Static usage statistics key - all self-hosted instances send to this project
const usageStatsKey = "phc_uh5ILOgLhZ4Pg5KLdrzTmiuZNLwsQeihA1Af1rTqNK1"
const usageStatsHost = "https://us.i.posthog.com"

// Check if usage statistics are enabled.
// Self-hosted: opt-in only (PRIMO_ENABLE_USAGE_STATS=true).
// Hosted mode: opt-out (PRIMO_ENABLE_USAGE_STATS=false to disable).
func isUsageStateEnabled() bool {
	override := os.Getenv("PRIMO_ENABLE_USAGE_STATS")
	if override != "" {
		return override == "true"
	}
	return isHostedMode()
}

// Send usage statistics
func sendUsageStats(pb *pocketbase.PocketBase) error {
	if !isUsageStateEnabled() {
		return nil
	}

	instanceId, err := getInstanceId(pb)
	if err != nil {
		return err
	}

	stats, err := getInstanceStats(pb)
	if err != nil {
		return err
	}

	encodedEvent, err := json.Marshal(event{
		ApiKey:     usageStatsKey,
		Event:      "instance_heartbeat",
		DistinctId: instanceId,
		Properties: stats,
		Timestamp:  time.Now().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	request, err := http.NewRequest(
		"POST",
		usageStatsHost+"/i/v0/e/",
		bytes.NewReader(encodedEvent),
	)
	if err != nil {
		return err
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}

	ok := response.StatusCode >= 200 && response.StatusCode <= 299
	if !ok {
		return fmt.Errorf("not OK response (got %d)", response.StatusCode)
	}

	return nil
}

// Get basic instance statistics (anonymous)
func getInstanceStats(pb *pocketbase.PocketBase) (*instanceStats, error) {
	var err error
	stats := &instanceStats{}

	stats.SitesCount, err = pb.CountRecords("sites")
	if err != nil {
		return stats, err
	}

	stats.PagesCount, err = pb.CountRecords("pages")
	if err != nil {
		return stats, err
	}

	stats.UsersCount, err = pb.CountRecords("users")
	if err != nil {
		return stats, err
	}

	return stats, nil
}

func RegisterUsageStats(pb *pocketbase.PocketBase) error {
	if !isUsageStateEnabled() {
		return nil
	}

	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Send initial stats
		if err := sendUsageStats(pb); err != nil {
			return err
		}

		// Set up daily heartbeat
		if err := pb.Cron().Add(
			"send_primo_usage_stats",
			"@daily",
			func() { sendUsageStats(pb) },
		); err != nil {
			return err
		}

		return serveEvent.Next()
	})

	return nil
}
