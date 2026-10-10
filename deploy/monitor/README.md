# Independent hosting monitor

The deployed Cloudflare Worker checks the hosting service every five minutes from
outside Fly. It uses a separate `HOSTING_MONITOR_TOKEN` that can read only
`GET /ops/monitor`; it cannot read jobs, emails, backup object names, credentials,
or perform operator actions. The service reports aggregate worker heartbeat,
provisioning failures, provider credential expiry, suspension delays, operator
purchase-notification failures/delays, and daily
backup freshness. This does not probe every customer's individual website.

Two failed checks open an incident. Two healthy checks send a recovery email.
SQLite-backed Durable Object storage retains incident IDs and mail checkpoints
across deployments. Resend idempotency keys prevent duplicate deliveries after a
lost response, failed sends retry, and an unresolved incident gets one daily
reminder. Alerts use the existing sending-only Resend key and operator address.
Runtime receives no Fly parent key, DNS editing key, R2 key or recovery identity.

All public HTTP paths return 404 except authenticated operator `GET /status` and
`POST /check`, protected by a separate random admin key. The cron invokes the same
persisted check internally. Redirects are rejected and outbound requests bounded.
The deployment credential requires only Workers Scripts Edit for the existing
account; its expiry does not stop an already-deployed monitor.

`worker.mjs` and `wrangler.jsonc` provide the source and deployment configuration.
For the prepared API deployment, use `python3 deploy/monitor/deploy.py
--private-dir /absolute/private/directory` after approval. The directory must have
mode 700, with the approved `cloudflare-monitor-deploy-key.json` and existing
`deployment-sandbox.json`; generated runtime secrets and metadata stay in files
with mode 600. It refuses to replace an unrelated pre-existing worker. Never
commit these files. No GitHub workflow or additional paid plan is required.

Before marking monitoring operational, verify private healthy checks, a real
failure/recovery alert, and a later scheduled check. A successful local test or
configured schedule alone is not proof that cron has run. Deployment is verified
on October 5, 2026: private healthy checks passed, a deliberately invalid monitor
credential produced an incident email, and restoring the credential produced a
recovery email. Resend reported both as delivered. A later real cron invocation
passed with the deployed source version and no issues. The test changed only the
monitor's credential; the hosting service stayed running. Live Maker/Solo billing
was activated afterward; the independent monitor remained healthy after cutover.

Run `node --test deploy/monitor/worker.test.mjs` for local incident/retry/deduplication
checks. Go tests cover monitor access restrictions and health aggregation.

References: [Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/),
[Worker upload API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/),
[SQLite Durable Objects](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).
