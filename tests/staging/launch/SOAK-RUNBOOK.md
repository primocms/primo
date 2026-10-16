# Bounded ten-editor soak runbook

Purpose: observe draft content persistence and tenant separation while ten independent synthetic editors work concurrently, plus reads of already-published QA pages. This does not measure publishing throughput, real user traffic or a production SLA.

## Inputs and proposed criteria

- Existing disposable production-mode RC.7 through its normal HTTPS ingress, with unique published marker; prove its executable hash separately.
- Ten distinct site-scoped editor accounts, ten distinct sites and ten root `qa_scratch` entries, with exact `QA scratch agency-NN` baselines. Reserve them exclusively for this run, including cleanup. No browser editor, synchronizer or second soak runner may write these entries during that window. Read-only observation is fine.
- Record CPU, RAM, disk, database size, proxy/CDN, connection/rate limits and background jobs. Supply read-only application/proxy logs and host CPU/RAM/disk/HTTP metrics during the run. This script does not collect provider metrics.
- Proposed minimum: **one hour, ten workers, one cycle per worker then a ten-second pause, zero workload/cleanup errors, p95 public response ≤1000 ms, p95 scratch save roundtrip ≤2000 ms**, all baseline identities/values restored, and no cross-site reads. Owner must confirm/replace these limits and set `criteriaConfirmed:true`; they are not an agreed product commitment yet.

Each worker reads a public fixture and, in edit mode, reads its scratch entry, PATCHes **only its value**, reads it back, verifies IDs/ancestry/bindings, and attempts one GET of the next tenant's entry (must return 403/404). No cross-tenant write is attempted. A cycle with ten editors uses about 50 workload requests; a one-hour run with ten-second pauses is at most roughly 18,000 plus setup/cleanup. Operation duration reduces cycle frequency; this is a closed-loop workload, not a fixed requests-per-second generator.

Limits: 1–20 workers, 1–86,400 seconds, ≥1000 ms pause, ≤100,000 **workload** requests, per-request timeouts. Setup (target checks, logins, ownership/role validation) and cleanup are outside that workload cap; their bounded requests are essential to safe restoration. Failures stop new cycles without hidden retries. The request client forbids publish/deploy/invite/create/delete APIs and credential forwarding outside the CMS origin. The script follows no redirects.

## Sequence

1. Complete configuration-only plans in README.md. Check the owner, environment ID, canonical URLs and private evidence location. Keep the frozen kit unchanged.
2. Run binary attestation and read-only preflight. Missing marker or non-production mode blocks authentication and writes.
3. Make a **separate local configuration** with `durationSeconds:60`, `workers:10`, `intervalMs:10000`, `criteriaConfirmed:false`; preserve `minimumGateSeconds:3600`. Rehearse read-only first:

```sh
node soak.mjs --config rehearsal.local.json --profile read --run
```

4. Reserve all ten scratch records and set `exclusiveScratchRecords:true`. With test-user variables loaded privately, rehearse edit mode:

```sh
node soak.mjs --config rehearsal.local.json --profile edit --run
```

5. Verify every cleanup item is `BASELINE_RESTORED`, compare IDs/bindings and check logs. A short run returns `PASS_REHEARSAL_ONLY`, never the launch soak gate. Do not proceed on errors, rate limiting, restore conflicts or unexplained host pressure.
6. Confirm criteria/hardware/observation window with the owner. Use the full-hour configuration with `criteriaConfirmed:true`. Run one edit workload:

```sh
node soak.mjs --config staging.local.json --profile edit --run
```

7. Observe metrics and stop if resources threaten the disposable environment or test isolation fails. Preserve the JSON report and sanitized metric/log exports for the same UTC time window. All ten canaries must return to their exact baseline, with identities/relationships retained. Independently inspect non-canary content and uploads against the supplied fixture expectations.

## Interruption and recovery

Ctrl-C/SIGTERM requests a stop. Already-started bounded requests finish or time out; workers are awaited before restoration. Cleanup is not blocked by the workload cap or aborted signal. The test records every attempted value before sending its write, covering a committed write whose response is lost. Restoration first compares the stored value and bindings; it restores only the original baseline or values from this run, preserving a detected concurrent edit.

**Comparison and restoration are not atomic.** The CMS provides no compare-and-swap for this API. Exclusive reservation is required; this tool cannot guarantee safety against an uncoordinated writer racing between its GET and PATCH. Do not use it on real content. There is no distributed lock, and no attempt to claim one.

SIGKILL, host/power loss or a failed cleanup request may leave a canary value. The report includes actor aliases and entry IDs; local config contains each known synthetic baseline. If recovery is needed, stop other writers, inspect the current value and identity in that one QA entry, and restore the known baseline only after confirming a `PRIMO-QA:<runId>:...` value belongs to the interrupted test. Preserve any unrelated edit and record the conflict. Never roll back the whole database just to restore a canary. If a report could not be written, capture the observed canary values and the process/time window before any manual action.

## Results

`PASS_SOAK` requires edit mode, at least ten validated actors, the confirmed minimum of at least one hour, and all thresholds plus cleanup checks passing. Read-only runs, fewer actors, unconfirmed criteria or shorter durations can report only `PASS_REHEARSAL_ONLY`. Any failure, interrupted run, cap reached or cleanup conflict fails the run. The aggregate error rate is failures divided by completed cycles plus failures; cleanup failures are included. p95 is nearest-rank over successful samples; a scratch save sample includes pre-read + PATCH + verified readback, excluding the cross-tenant probe.

Attach result JSON, confirmed criteria, hardware inventory and metrics before reviewing this gate. Publication, second-user mail acceptance, DNS lifecycle and actual-device handoff stay separate. Nothing here publishes, deploys or changes the draft status of a PR.
