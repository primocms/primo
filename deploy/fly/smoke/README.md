# Fly hosting smoke deployment

This is an isolated deployment proof, not the signup provisioning service.

- Organization: `primo-hosted`
- App/private network: `primo-hosted-smoke`
- Region: `iad`
- Machine: `8940edb6d97de8`, one shared CPU, 512 MB RAM, always running
- Volume: `vol_v8eq2dqppmq8xjkv`, 1 GB, encrypted, mounted at `/app/pb_data`
- Daily Fly snapshots: enabled, seven-day retention
- Temporary workspace URL: <https://primo-hosted-smoke.fly.dev/admin/auth>
- Workspace URL: <https://fly-smoke.primo.page/admin/auth>
- Published test site: <https://site.fly-smoke.primo.page>

## Image and startup fix

`fly.toml` pins the smoke image by digest in the organization's Fly registry.
The image was built from a clean archive of `v3.3.0` plus the Fly domain adapter
and these migration changes:

- Remove cap seeding from the early settings migration. At that point the
  configuration collection still has its legacy name and only permits the
  `instance_id` key.
- Add `1791148000_hosted_plan_caps.go` after the configuration rename. It permits
  `site_cap` and `editor_cap`, seeds positive env values, and preserves existing
  stored values on upgrades.

The published `ghcr.io/primocms/primo:3.3.0` image failed fresh-server startup when
`PRIMO_SITE_CAP` was configured. The fix must be included in a public release before
automated customer provisioning uses the normal release image.

The current image is `3.3.0-fly-smoke.2`, tagged
`registry.fly.io/primo-hosted-smoke:fly-domain-smoke-20261004`. The new domain
adapter is enabled (`fly`) with an explicitly approved, app-scoped 24-hour test
token. No operator or organization token has been injected into the customer app.
The token expires at `2026-10-05T22:39:29Z`; renew test access before repeating
custom-domain attachment/status checks after that time. Credential values live
only in Fly secrets and the private `.tools/fly/domain-token.env`, outside this
Git repository.

## Provisioning order

Commands assume an authenticated Fly CLI with access to `primo-hosted`.
Run from the Primo repository root. For another test app, change the app name,
network, URL, and configuration first.

1. Create the app in its own private network:

   ```sh
   fly apps create primo-hosted-smoke --org primo-hosted --network primo-hosted-smoke
   ```

2. Create the volume before the first boot:

   ```sh
   fly volumes create pb_data --app primo-hosted-smoke --region iad --size 1 --snapshot-retention 7 --yes
   ```

3. Generate separate random superuser/customer passwords in a private file
   (mode `600`) outside version control. Include `PRIMO_SUPERUSER_EMAIL`,
   `PRIMO_SUPERUSER_PASSWORD`, `PRIMO_USER_EMAIL`, and `PRIMO_USER_PASSWORD`.
   Stage them before exposing the server:

   ```sh
   fly secrets import --app primo-hosted-smoke --stage < /path/to/private/smoke.env
   ```

4. Deploy exactly one Machine. Default Fly high availability creates separate
   Machines/volumes, which is unsuitable for this SQLite deployment:

   ```sh
   fly deploy --config deploy/fly/smoke/fly.toml --ha=false --yes
   ```

5. Seed and verify synthetic test content:

   ```sh
   python3 deploy/fly/smoke/verify.py --credentials /path/to/private/smoke.env --seed
   ```

6. Remove the one-time bootstrap secrets after successful account initialization,
   redeploy, and re-run verification **without `--seed`**. This verifies the stored
   accounts and content rather than recreating missing data.

   ```sh
   fly secrets unset PRIMO_SUPERUSER_EMAIL PRIMO_SUPERUSER_PASSWORD PRIMO_USER_EMAIL PRIMO_USER_PASSWORD --app primo-hosted-smoke --stage
   fly deploy --config deploy/fly/smoke/fly.toml --ha=false --yes
   python3 deploy/fly/smoke/verify.py --credentials /path/to/private/smoke.env
   ```

Account credentials for this deployment are retained in the workspace's private
`.tools/fly/smoke.env`, outside this Git repository. Do not publish that file.

## Verified on 2026-10-04

- Backend tests pass, including fresh provisioning, uncapped self-hosted installs,
  and preserving an operator's stored limits when upgrading.
- HTTPS health, hosted mode, Maker's three-site cap, and customer sign-in pass.
- The public installer account is unavailable after initialization.
- Synthetic records, original uploaded bytes, published HTML, and published upload
  bytes remain intact after both a Machine restart and a normal redeployment.
- One-time bootstrap secrets were removed from the app after initialization.
- Cloudflare GitHub sign-in succeeded; four test-only DNS records were added.
- Fly workspace and wildcard certificates are active. Direct wildcard site and
  upload routing pass over HTTPS, including after restart.
- The app environment and persisted PocketBase App URL use `fly-smoke.primo.page`.
- Live Fly custom-domain integration passed for the separate synthetic site
  `flydomainsite01` at <https://fly-domain-test.primo.page>. Customer attach,
  duplicate adoption, hostname validation, authentication, automatic certificate
  status, HTTPS published HTML/uploads, and restart persistence all pass. The
  dashboard displays the provider's DNS records and advances to Live. Switching
  to an included subdomain and back through the dashboard preserves published
  content and removes the old hostname's published content.
- Snapshot recovery was tested without reseeding: snapshot
  `vs_Aq6VPKe2GZYwIxAx3QZZYj4` was restored onto a separate encrypted volume and
  booted on a private Machine with no public services. Original accounts,
  database records, uploaded bytes, published HTML, and published upload bytes
  all passed. The temporary Machine and restored volume were removed afterward;
  the original volume and snapshot remain intact.

## Verified DNS setup

Both hostnames are registered on Fly and have active certificates.
Fly returned these records for this app; generate fresh values for other apps.

| Type | Name in the `primo.page` zone | Value | Cloudflare proxy |
| --- | --- | --- | --- |
| CNAME | `fly-smoke` | `o9ryxkr.primo-hosted-smoke.fly.dev` | DNS only |
| CNAME | `*.fly-smoke` | `o9ryxkr.primo-hosted-smoke.fly.dev` | DNS only |
| CNAME | `_acme-challenge.fly-smoke` | `fly-smoke.primo.page.o9ryxkr.flydns.net` | DNS only |
| TXT | `_fly-ownership.fly-smoke` | `app-o9ryxkr` | DNS only |

The workspace and wildcard share the ACME delegation and ownership records.
All test records are DNS-only, with TLS served by Fly. Existing tenant records
and zone-wide settings were unchanged. Cloudflare shows 37 of 200 records used
after these additions. Keep the nested site wildcard DNS-only. The workspace
proxy is optional and requires Cloudflare SSL mode Full (strict).

The environment is configured with `PRIMO_APP_URL=https://fly-smoke.primo.page`
and `PRIMO_BASE_DOMAIN=fly-smoke.primo.page`. `PRIMO_APP_URL` seeds persisted
PocketBase settings only on first boot; the stored App URL was also updated for
this existing test deployment.

Verify `site.fly-smoke.primo.page` serves the published test page and its uploaded
file. Repeat the check after a restart. The existing smoke script also accepts
`--url https://fly-smoke.primo.page`.

## Remaining work

- Implement production token renewal and cleanup of old provider certificates.
- Add application-consistent, off-volume backups and define retention/recovery
  targets before customer rollout; daily snapshots alone can lose newer writes.
- Build resumable provisioning and the purchaser-only account claim flow.
- Connect Polar, setup emails, billing lifecycle, and alerts.

## Repeat the custom-domain proof

With the Fly provider enabled and a valid app-scoped token, run:

```sh
python3 deploy/fly/smoke/verify_domains.py --credentials /path/to/private/smoke.env --prepare
```

This uses a separate synthetic site and prints the provider's required records.
Add those records at the DNS provider. The verified records in `primo.page` are:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| CNAME | `fly-domain-test` | `o9ryxkr.primo-hosted-smoke.fly.dev` | DNS only |
| CNAME | `_acme-challenge.fly-domain-test` | `fly-domain-test.primo.page.o9ryxkr.flydns.net` | DNS only |
| TXT | `_fly-ownership.fly-domain-test` | `app-o9ryxkr` | DNS only |

After propagation, verify without seeding:

```sh
python3 deploy/fly/smoke/verify_domains.py --credentials /path/to/private/smoke.env --require-live
```

Cloudflare uses 40 of 200 records after the workspace and custom-domain proofs.
Root-domain A/AAAA guidance is covered by backend tests; this live proof uses a
custom subdomain and does not change the existing `primo.page` apex.
