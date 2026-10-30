# Hosted signup automation

Deployed on Fly with live Polar billing for new Maker and Solo purchases.
The customer domain adapter, isolated Fly deployment, guarded fresh-server
bootstrap, and actual Resend setup/ready email delivery have passed live tests.
This service is a separate Go binary (`cmd/primo-hosting`) with its own SQLite volume.
It does not run inside customer apps or modify existing Railway tenants.

## Customer flow

1. A signed Polar `order.paid` event creates a durable job. Only
   `billing_reason=subscription_create`, supported product UUIDs and orders created
   on/after the configured cutover are eligible. Monthly renewals, subscription
   changes, pre-launch orders and Agency products cannot create extra servers.
2. Resend delivers a private 72-hour setup link to the purchase email. Link tokens
   use URL fragments and SHA-256 lookup hashes. GET requests and email link scanners
   cannot consume them. Customer names/passwords are submitted through HTTPS JSON.

3. The purchaser chooses a server name and password. An atomic transaction reserves
   the slug, consumes the invitation once, and creates a separate secure status
   cookie. The purchaser cannot replace the email or plan from the webhook.
4. A worker creates an isolated Fly app/network, an encrypted volume with daily
   snapshots, an app-only domain token and **one** 512 MB Machine. The Machine boots
   with no public services. A managed-bootstrap guard refuses to start without a
   real superuser and verified developer account. First-boot migration errors abort
   startup. A private check also rejects images missing this guard.
5. The worker allocates shared IPv4/IPv6, attaches workspace/wildcard certificates
   and creates DNS-only records. It waits for actual issued certificates, then
   enables public HTTP/HTTPS and checks plan caps, workspace/wildcard HTTPS, customer
   sign-in, and rejection of the old public installer account.
6. With hosted SMTP configured, a sending-only Resend key restricted to
   `email.primo.build` is created for this customer. Its password is checkpointed
   encrypted before applying and verifying PocketBase SMTP (465, implicit TLS),
   sender and workspace URL settings. Setup failures block the ready email.
7. Bootstrap secrets are removed, the Machine is updated to that secrets version,
   and sign-in/HTTPS checks run again after restart. The control plane then discards
   the customer's password and sends the dashboard link. The customer signs in at
   `/admin/auth` with their purchase email and chosen password.

The same paid-order receipt durably queues an operator notification, replacing the
old notification-only Zapier integration, which is now disabled. Notices also
cover post-cutover manual products and renewal/change payments; those cannot
allocate a customer server. Messages identify the purchaser, order, product and
whether automatic setup is queued or manual review is needed, without a private
claim link or password. Customer details are encrypted in the notification queue.
Order-ID hashes deduplicate different event-delivery IDs. The worker sends at most
one bounded notice per tick after customer provisioning, with durable backoff and
Resend idempotency keys. Failed operator email does not fail customer setup.
Historical receipts are not backfilled when deploying this feature. Monitoring
reports aggregate notification failures/delays without customer details.

Job state, purchase email and credentials are encrypted with AES-256-GCM at rest.
Keep the encryption key in Fly secrets and separately in the operator's password
manager: losing it makes the state unrecoverable. The SQLite file is mode 600.
Operator bootstrap credentials remain encrypted for support access; customer
servers never receive the Fly organization token, Cloudflare token, control-plane
email key or SMTP management key. Each receives its own restricted SMTP key.

## Recovery and limits

Each phase checkpoints before the next begins. Retries reconcile existing apps,
volumes, Machines, certificates and DNS records. Conflicting DNS records are never
overwritten. The worker uses a five-minute database lease and bounded steps.
App credentials are derived locally by attenuating the organization token with
the app's numeric ID. Fly organization tokens cannot issue separate deploy tokens.
Local derivation can retry safely after a crash without minting external tokens;
the private identity check must pass before the credential reaches the customer.
Email deliveries use stable Resend idempotency keys (provider retention is finite,
so delivery is at least once across very long outages).

DNS/TLS polling uses ten-second retries. Provisioning failures stop for review
after 20 minutes or 12 failures, with an operator email after repeated failures.
Provider response bodies, passwords and tokens are excluded from logs and public
status. The status page refreshes without requiring another setup-link use.

Each workspace needs **four** Cloudflare records: workspace CNAME, wildcard CNAME,
ACME delegation CNAME and app-ownership TXT. The worker checks configured zone
capacity before allocating the app; default limit 200. At 40 existing records this
allows about 40 additional workspaces, assuming no other record growth. Raise
`HOSTING_DNS_RECORD_LIMIT` only after changing the actual Cloudflare plan/limit.
This automation does not remove Cloudflare's cap.

App-only domain credentials inherit the organization token's expiry and revocation,
with an additional one-year ceiling. The approved replacement parent expires on
October 5, 2027 UTC (October 4 in Chicago); the zone DNS token expires October 4,
2027 UTC. Both are installed and verified in the running signup service.

The credential worker checks every minute, caching provider validity checks for
one hour. A changed parent automatically queues a restricted replacement for every
active ready job. It also extends a child nearing its one-year ceiling when the
parent permits a longer lifetime. Issuance, app-secret installation, Machine update
and verification are separate durable encrypted checkpoints. It retains the last
verified child until its replacement's hash is loaded on the running Machine,
private PocketBase health passes and the restricted token can read its own app.
The update preserves the existing image, storage and service configuration. A
running Machine may briefly restart to load its new secret. Stopped Machines remain
off; their update waits until an operator starts them. Retired jobs are skipped.
Ready servers under a manual billing-review hold remain maintained while serving.

Fly exec acquires its own lease, so the running-key check precedes the update lease.
The stopped-state check is repeated under that lease, and the update uses the
Machine's current instance version. Retries reconcile an already loaded token to
avoid repeating a successful restart after a lost provider response. Replacing the
parent again supersedes any incomplete update under its predecessor.

Operator expiry alerts escalate at 30, 14, 7 and 1 day remaining, and at expiry.
Successful notification checkpoints survive process restart. Failed notifications
retry without blocking customer updates; repeated update failures alert the operator
and continue retrying. The parent keys still require an operator to replace them;
the worker never creates broader organization or zone access by itself. After
replacing the Fly parent, wait for `/ops/credentials` to report
`previous_parent_updates_complete:true` and inspect any remaining job updates before
revoking its predecessor. This includes issued credentials on unfinished signups.
Customer servers never receive the unrestricted parent or Cloudflare token.

These checks run inside the signup service. The independent Cloudflare monitor
also checks uptime, queue, backup freshness and credential expiry, so a stopped
control plane cannot silently prevent alerts. Existing certificates keep serving if a domain credential expires,
but domain management fails until the credential is replaced.

`subscription.revoked` durably holds new provisioning and schedules suspension no
earlier than the current paid-period end, including when delivery precedes the paid
order. Ordinary cancellation/uncancellation does not stop access. `order.refunded`
remains a manual review hold and never automatically suspends a ready server.
Suspension captures the complete original Machine configuration in the encrypted
job, removes public services, disables restart, and verifies it is not running.
App, volume, DNS and existing R2 archives remain. Retries reconcile lost responses;
no suspension code deletes resources. Plan changes, refunds and restoration remain
manual. Customer backups and domain-key updates skip completed suspensions.

Private operator routes require `Authorization: Bearer HOSTING_OPS_TOKEN`:

- `GET /ops/jobs`: steps, resource handles, retries and domain-token expiry; no secrets.
- `POST /ops/jobs/{id}/retry`: resume a failed step after fixing its cause.
- `POST /ops/jobs/{id}/resend`: rotate an unclaimed/expired invitation and email only
  the original purchaser. Old links become invalid. Claimed setups cannot be reset.
- `GET /ops/backups`: backup enablement and successfully completed archive checkpoints.
- `GET /ops/notifications`: aggregate pending/delivered purchase-notification counts.
- `GET /ops/credentials`: provider validity, active ready-job count, pending parent
  updates and whether all recorded previous-parent credentials have been replaced.
  `/ops/jobs` also shows each update phase, attempts, next retry and verified time;
  pending tokens and parent fingerprints are never returned.
- `POST /ops/jobs/{id}/retire`: mark a ready job retired after an operator has removed
  its disposable resources. This bookkeeping skips it in workers; it deletes no data
  or provider resources.

Billing holds intentionally cannot be bypassed with the ordinary retry endpoint.
Resolve them against Polar and the recorded subscription before explicitly removing
the corresponding hold through a private maintenance session.

## Deployment gates

### Current production configuration

Live billing was activated on October 5, 2026 UTC, with
`HOSTING_CUTOVER_AT=2026-10-05T05:12:57Z`. The live Polar organization is `primocms`.
The enabled Raw endpoint `20632a5d-50df-405a-a215-f5c9794fb4cc` uses API version
`2026-04`, Standard Webhooks, and only `order.paid`, `order.refunded`, and
`subscription.revoked`. Its signing secret is installed in Fly; sandbox signatures
are no longer accepted. The billing portal is `https://polar.sh/primocms/portal`.
Customer portal plan changes are disabled; plan changes remain manual.

| Product | Monthly UUID | Annual UUID | Server limits |
| --- | --- | --- | --- |
| Maker | `88838f08-5943-4f98-af77-47b991eca460` | `3446e360-dde1-455c-84ba-3c552c283018` | 3 sites; owner only |
| Solo | `b9e8a66d-6511-4f97-9c78-4f83772ec1e3` | `046e8b83-84fa-4790-95b6-4b73c926f1b2` | 7 sites; 2 editors per site |

Other products, including Agency, notify the operator for manual setup and do not
automatically allocate resources. Existing Railway subscriptions stay on Railway;
their renewals do not create Fly servers.

Running configuration hashes, live-key signature acceptance, sandbox-key rejection,
cutoff/replay/renewal/unsupported-product filtering, healthy monitoring, and the
unchanged original smoke Machine were verified after activation. Verification
created no customer job or email. The complete purchase-to-server flow had already
passed with an actual Polar sandbox checkout and provider delivery. No real payment
was submitted to test activation; the first real live delivery is still unobserved.

The old notification-only Zapier endpoint `59dc1117-71b3-48bc-8927-fc02ebc7d72a`
was saved disabled and verified disabled after reload. It is retained for rollback.
Private production configuration and the prior sandbox configuration are stored
outside Git. To pause new signups, disable the live endpoint in Polar; do not delete
customer apps, volumes, DNS, the database, or backups. Reactivate the old endpoint
if manual notifications are needed while automation is paused.

Recovery keys have been saved privately off Fly on this computer. The operator
still needs to copy them into a password manager or another secure off-device
location; that copy has not been confirmed. The checkout confirmation text was
updated locally in `Desktop/primo-server/sites/primo-marketing-site/pages/success.yaml`
and passed Primo page validation. Live publishing has not been performed.

The sections below include earlier test history; their sandbox-only descriptions
refer to those test dates, not the current production configuration above.

The prepared `fly.toml` uses the app's default Fly HTTPS domain for setup links,
avoiding another DNS record. Create in **Primo Hosted**, isolated network, a 1 GB
`hosting_data` volume, and deploy with `--ha=false`. Never use multiple Machines
with independent SQLite copies. Check app-name availability before deployment.

Fill `config.example.env` privately, outside Git. Required external access:

- Fly org deploy token restricted to `primo-hosted`, held only by the control plane.
- Cloudflare DNS-edit token restricted to the `primo.page` zone and its zone ID.
- Sending-only Resend key plus verified sender domain and operator alert address.
- Polar product UUIDs and a **new Raw webhook endpoint** at
  `https://primo-hosting-control.fly.dev/webhooks/polar`, initially in sandbox.
  Subscribe to `order.paid`, `order.refunded`, `subscription.revoked`. New signing
  secrets use Standard Webhooks; `POLAR_WEBHOOK_SCHEME=legacy` supports old Polar
  secrets explicitly. Do not confuse product IDs with marketing checkout-link IDs.

Maker has 3 sites; Solo has 7 sites and 2 editors per site in the marketing source.
Maker is owner-only: set `owner_only:true`, which blocks additional customer
accounts, collaborator grants/edits and non-owner sign-in, while keeping owner
profile edits and site ownership working. This is separate from the historical
editor cap `0` meaning unlimited. The pinned `.4` image includes this guard and
passed a private Fly Maker boot/restart and invitation rejection test.
Studio (20 sites / 10 editors) can be mapped if in launch scope. Agency
stays manual. Verify monthly and annual UUIDs in the actual Polar account.

Refunds and plan changes remain manual by operator decision. Do not automatically
delete customer data. Ordinary cancellation stops renewal and keeps access through
the paid term. The deployed worker handles terminal revocation with durable,
idempotent suspension after that term. Disable customer portal plan changes before
production activation, because billing changes alone do not update server caps.

Cloudflare R2 is the deployed off-volume backup destination. Customer apps run
PocketBase. The central worker authenticates to each active ready customer's
PocketBase administrative API, creates a consistent native database/files export,
streams it through age encryption, and uploads it to the private Standard bucket
`primo-hosted-backups` under `customers/<job-id>/YYYY-MM-DD.zip.age`. A consistent
SQLite `VACUUM INTO` snapshot is encrypted under `control-plane/YYYY-MM-DD.sqlite.age`.
The bucket has public access disabled; its approved persistent object read/write
key is restricted to that bucket and held only by the control plane. Customer
apps receive no R2 key. Fly holds only the public age recipient; the private age
identity and original SQLite credential-encryption key must be secured separately
off Fly. Both are required to recover control-plane operator credentials.

The worker checks hourly and records one successful backup per UTC day. It reads
back and compares each encrypted R2 object before checkpointing success and removing
only its own temporary PocketBase export. Failed uploads retain that export for
retry. Failures generate an operator email. Remote archives are retained without
automatic pruning or customer-data deletion. Uploaded files in external S3 storage
are rejected by this backup path and require a separate verified backup integration.
Fly volume snapshots remain an additional recovery layer.

On October 5, the deployed control-plane R2 archive was decrypted and restored,
including encrypted operator credentials. A disposable private Fly Maker server's
R2 archive restored the owner's sign-in, persisted owner-only policy, and uploaded
PNG bytes. That test's Machine, volume and passwords were removed. These are actual
remote upload/readback/restore checks, in addition to local backup contract tests.

Pin the customer image containing the cap fixes, Fly provider, bootstrap-save
error handling and managed guard. Neither public `3.3.0` nor the earlier `.2`
smoke image is sufficient. Do not deploy unrelated local frontend edits.

Before enabling production: run a signed sandbox purchase through real email,
claim, resource creation, HTTPS and dashboard sign-in; repeat webhook and restart
the worker; confirm one app/volume/Machine; test recovery after a failed phase;
verify operator alert delivery. Update the marketing success page only when the
flow is live. Keep existing manual billing notifications as fallback.

Back up the control-plane database consistently off its volume and test restoring
it together with its encryption key. Customer PocketBase backups also need an
app-consistent off-volume destination and restore policy. Daily volume snapshots
alone remain a floor, not complete production recovery. R2 integration, actual
restore checks, independent monitoring and live billing activation have passed.
Securing the private recovery keys off this computer remains an operator task.

## Validation

`go test ./hosting ./internal ./migrations ./cmd/primo-hosting`

Tests cover signature schemes/tampering/replay, renewal and cutover filtering,
event/subscription deduplication, concurrent and expired claims, encrypted durable
state and process restart, worker/mail/claim races, billing holds arriving first,
private operator/status access, fail-closed account bootstrap, and provider
contracts with lost creation responses. Provider tests simulate APIs; they are
not a substitute for the live sandbox purchase above.

`go test -race ./hosting` and `go vet ./hosting ./cmd/primo-hosting` also pass.
The setup form has been exercised in Chrome through claim, progress, completion,
and refresh using a local simulated provider; no purchase or email was sent.

On October 4, 2026, `verify_bootstrap.py` created disposable private resources in
`primo-hosted-smoke` with the guarded customer image. Clean first boot, both
bootstrap accounts, Solo limits, and customer sign-in after a stop/start passed.
The test removed its own Machine and volume. The existing public smoke Machine,
its storage, and its deployed image were unchanged. This test uses no public
services and does not prove the purchase-to-DNS/email pipeline.

A subsequent live test used the approved organization and zone DNS credentials,
a synthetic signed paid order, and locally captured email. The real provider
created exactly one isolated app/volume/Machine, booted privately, configured four
DNS records and root/wildcard HTTPS, verified customer sign-in, removed bootstrap
secrets and verified again after restart. Reopening the worker database during
TLS polling and replaying the signed order produced no duplicate job/resources.
A derived app credential could access its own app (HTTP 200) and was denied access
to the existing smoke app (HTTP 403). This verifies real infrastructure provisioning;
it does not verify actual Polar delivery or Resend delivery. Production purchases
remain disconnected. The first test found and corrected the unsupported attempt
to issue a deploy token from an organization token.

All four test DNS records, the test Machine, volume and app were removed after
verification. The zone returned to 40 records. Existing customer DNS and the
original smoke app were untouched. The final image includes the corrected local
derivation and safe retries; it is now deployed as the control plane in test mode.

The live Polar catalogue was inspected read-only: the organization slug is
`primocms`, with separate monthly/annual products for Maker and Solo. Resend has
the verified sending domain `email.primo.build`. A sending-only key restricted to
that domain was created with approval and installed privately. No production
webhook has been created for this service.

Deployed, privately built image pins are recorded in `images.json`. Both build
contexts excluded unrelated working-tree frontend changes.

The deployed control plane is `https://primo-hosting-control.fly.dev`, one 512 MB
Machine with a 1 GB `hosting_data` volume. Its allowed product is currently only the mock Solo product in
`primo-hosted-test`, with that isolated sandbox webhook signing secret. Production
Polar product UUIDs and production webhooks remain disconnected.

A signed synthetic order through that deployed service delivered a setup email
to the approved operator address through Resend. The emailed setup page correctly
bound the recipient and Solo plan. Claiming through the HTTPS API provisioned one
real isolated customer app, volume and Machine; HTTPS and customer sign-in passed.
Resend confirmed both setup and ready messages as delivered. Restarting the control
plane preserved the ready job and secure status session. Replaying the signed
event created no second job or resources. The temporary customer app, volume,
Machine and four matching DNS records were removed; the zone returned to 40
records. This proves the deployed service and real email pipeline, but still uses
a synthetic order rather than an actual Polar sandbox checkout/webhook.

The deployed setup page was inspected in Chrome; the actual claim and ready status
were checked through HTTPS JSON with private test credentials. The full browser
claim/progress/refresh test above used the local simulated provider. Production
remains gated by final billing cutover. Independent monitoring and paid-period
suspension are now verified. The deployed R2 backups and owner-only Maker image passed
actual restore checks.

An isolated Polar sandbox organization, `primo-hosted-test` (Primo Hosted Test),
was created with approved terms acceptance. Its mock monthly Solo product is
`159718b9-574c-4f6b-9782-f7c6038eee9f` ($1 mock price, 7 sites / 2 editors). A Raw
webhook using API version `2026-04` was created with approval for the deployed
endpoint, limited to `order.paid`, `order.refunded` and `subscription.revoked`.
Its signing credential is stored privately and installed in Fly secrets; the
single existing control-plane Machine was updated and HTTPS health passed. Only
that mock product is allowed; production product mappings remain inactive.
The deployed handler accepted a valid sandbox signature for an unsupported test
product without creating a job/email, and rejected an invalid signature. A mock
checkout link was created using Stripe’s official test card and fictional billing
details. After approved Buyer Terms acceptance, the actual mock purchase succeeded
on October 4, 2026 (Chicago time), and Polar delivered `order.paid` with HTTP 202.
Resend delivered the resulting setup invitation to the approved operator address.
The invitation correctly bound that recipient and Solo plan. Claiming through
the HTTPS setup API provisioned exactly one app/volume/Machine with root/wildcard
HTTPS, 7 sites / 2 editors, developer sign-in, installer rejection and bootstrap
secret removal. The secure setup session reported ready, and Resend delivered
the ready email. Redelivering the same actual event from Polar returned HTTP 202
and produced no second signup job or resource set. This completes the real sandbox
purchase-to-server integration check.

The disposable Polar-test app, Machine, volume and four exact DNS records were
removed after final checks; the zone returned to 40 records. Its generated test
password and session cookie were discarded. The mock subscription was cancelled
at the end of its current period to prevent test renewal emails. Existing customer
DNS, Railway tenants and the original smoke app were unchanged. The control plane
and sandbox webhook remain installed, accepting only that sandbox product. The
emailed temporary customer dashboard URL no longer serves after cleanup.

Sources: [Polar webhook delivery](https://polar.sh/docs/integrate/webhooks/delivery),
[paid orders](https://polar.sh/docs/features/orders),
[Fly Machines](https://docs.fly.io/machines/api/machines-resource/),
[Fly secrets API source](https://github.com/superfly/fly-go/blob/main/flaps/flaps_secrets.go),
[Fly token caveats](https://github.com/superfly/macaroon/blob/main/flyio/caveats.md),
[Cloudflare DNS API](https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/create/),
[Resend email API](https://resend.com/docs/api-reference/emails/send-email).

The approved one-year Fly organization token and Cloudflare zone DNS-edit token
were installed on October 4, 2026 (Chicago time). Fly organization identity and
Machines access, Cloudflare token validity and zone DNS access, both secret hashes
in the running control Machine after restart, and HTTPS health all passed. Customer
apps did not receive either parent token. No production product mapping or billing
webhook was enabled. The subsequently verified credential worker distributes replacements automatically
and sends advance expiry alerts. Independent monitoring is now deployed and verified.

The explicit integration test `go test -tags flyrotation ./hosting -run
'^TestFlyDomainRotationProof$' -count=1` creates one private disposable app, Machine
and encrypted volume using private operator files. The real old-parent to new-parent
update, encrypted pending-state recovery after reopening the database, running-key
hash, private health, certificate API access, cross-app denial (403), stopped-server
safety and owner sign-in all passed. Every test resource was removed and app removal
was independently verified with HTTP 404; no DNS records were created. Normal tests
do not contact Fly. The original smoke Machine and Railway servers remain unchanged.

The verified credential worker image is deployed to the sandbox-only signup service.
Its private provider-status endpoint reports healthy Fly and DNS validity checks,
zero active ready customers and zero pending parent updates (the two removed test
jobs remain retired). The backup worker is still enabled with recorded successful
archives. The original public smoke Machine's configuration was compared before and
after deployment and stayed identical; it remains started. Production purchases are
still disconnected. Final Go package tests, race detection, vet and diff checks pass.


## Verified cancellation and independent monitoring

The cancellation worker and separate read-only `/ops/monitor` endpoint are deployed
in the sandbox-only control service. The private endpoint reports healthy worker,
provider credential and backup status, with no active customers and two retired
proof jobs. The original smoke Machine configuration remains identical.

The explicit `flysuspension` test passed on a private disposable customer app:
access remained through the paid period; the captured original configuration
survived reopening SQLite; routes and automatic restart were disabled; the Machine
stayed off while its app and encrypted volume remained; operator restoration
recovered owner sign-in and a saved file. The disposable app, Machine and volume
were removed, with independent GET 404 checks and no leftover customer test apps.
Fly may omit empty services and represent a configured, non-running Machine as
`created` rather than `stopped`; both are reconciled. Operator restoration must wait
for configuration replacement to finish before requesting start. Restore the saved
configuration, explicitly start and verify it, then resolve the billing hold and
suspension checkpoint through reviewed maintenance. Ordinary retry cannot bypass
these holds. Refresh an expired restricted domain credential before restoring.

The Cloudflare Worker in `deploy/monitor` is deployed and verified. It checks
every five minutes, persists incident state, sends alerts after two failed checks,
and sends recovery after two healthy checks. Runtime has only aggregate read access
and sending-only Resend. Its approved temporary deployment credential has only
Workers Scripts Edit and expires November 4, 2026; expiration does not stop the
deployed monitor. Private healthy checks, real failure/recovery emails (both
reported delivered by Resend), and a subsequent healthy scheduled invocation
passed. Testing changed only the monitor's read-only credential and restored it;
the hosting service and customer resources were unaffected. The runtime never
receives the deployment credential. Source-version and scheduled-run timestamps
are available through its separate authenticated status endpoint.

The production Raw webhook and four Maker/Solo monthly/annual mappings are live,
as recorded in Current production configuration above. The old notification-only
Zapier endpoint and completed sandbox endpoint are saved disabled and retained.
The replacement purchase-notification worker is deployed: a signed manual-product
test delivered one real operator email (verified Delivered in Resend), a different
delivery ID did not repeat it, and no customer job or resource was created.
Customer portal plan changes are disabled and verified in Polar to enforce the
approved manual policy. Go tests, race checks, vet and local monitor tests passed.


## Automatic customer SMTP

Set both `HOSTING_SMTP_MANAGEMENT_TOKEN` and `HOSTING_SMTP_DOMAIN_ID` on the
control plane to enable automatic SMTP for new signups. The management token must
be a dedicated Resend full-access key, distinct from `RESEND_API_KEY`; Resend does
not offer a keys-only management permission. Never install it in customer apps.
The domain ID must identify the verified `email.primo.build` sending domain.
`HOSTING_FROM_EMAIL` must use that domain, e.g. `Primo <hello@email.primo.build>`.
With neither variable, legacy manual SMTP behavior remains available; setting only
one is a startup error. Enabling this does not change existing ready customer settings.

Customer keys are named `primo-hosted-<job ID>` with `sending_access` and the
configured `domain_id`. They are not reused across customers. Retrying after a
lost create response/checkpoint revokes only orphan keys with that exact job-owned
name before replacement; unrelated keys remain untouched. The key password is
removed from the control-plane credential checkpoint after final verification,
while its ID is retained for lifecycle cleanup. PocketBase retains the customer
key in its settings database, persisted on the customer's encrypted Fly volume.
No SMTP password or parent email credential is installed in customer environment
variables or returned in operator/customer status output.

`POST /ops/jobs/{id}/retire` now revokes that customer's SMTP key before saving
retirement; failures prevent retirement and can be retried. It still does not
remove the app, data, DNS or billing. A subscription hold/suspension alone does not
retire a server or revoke its key. Operators should retire removed workspaces.
Resend sending limits and reputation are shared at account/domain level; these
keys isolate credentials and revocation, not per-customer provider quotas.
