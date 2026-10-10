# Fly hosted servers

This directory contains a verified smoke deployment, the Fly domain provider,
and the implemented signup service in [hosting/README.md](hosting/README.md).
Signup automation passes local tests and a simulated browser flow; it is not
connected to real purchases or customer provisioning yet.

## Customer domain support

Select the Fly provider with:

```text
PRIMO_DOMAIN_PROVIDER=fly
PRIMO_FLY_TOKEN=<app-scoped Fly deploy token>
FLY_APP_NAME=<customer app name>
PRIMO_BASE_DOMAIN=<workspace>.primo.page
```

Fly injects `FLY_APP_NAME` into running Machines. Configure the base domain only
after the workspace and wildcard DNS/TLS are ready. Primo avoids separate
certificate requests for direct child subdomains already covered by that wildcard.
Deeper subdomains require a separate certificate.

`PRIMO_FLY_TOKEN` must be scoped to that customer app. Never pass an organization
provisioning token or the operator's login token into a customer server. Use an
explicit expiry and plan token renewal before automated customer rollout.

The provider uses Fly's Machines API certificate endpoints:

- Adopt an existing certificate, or request ACME issuance for a new hostname.
- Trigger DNS checks when the dashboard polls or refreshes status.
- Show CNAME routing for subdomains and A/AAAA routing for root domains, including
  multi-label public suffixes such as `example.co.uk`.
- Show ACME delegation and app-specific ownership TXT records.
- Report live only when routing validates and an unexpired certificate is active.
- Preserve pending/verifying status while DNS propagates; API failures remain
  retryable and do not expose raw upstream responses or credentials.

The existing dashboard/editor domain dialog handles these records and polls
until live. Fly can use the same endpoints as Railway. Keep certificate-validation
records DNS-only if the DNS provider offers a proxy switch.

This supports one custom hostname per site, matching the current Primo model.
Automatic `www` aliases and detaching old provider certificates when switching
hosts are separate work; replacing the site's host already removes its old
published files. Existing Railway instances continue using their own provider.

Reference: <https://docs.fly.io/machines/api/certificates-resource>

## Validation

`go test ./internal ./migrations` covers fresh provisioning and the Fly adapter's
request authentication, duplicate adoption, root-domain records, DNS/certificate
states, expired certificates, redirects, failures, and wildcard coverage.

See [smoke/README.md](smoke/README.md) for the live server, verified DNS records,
and completed snapshot restore drill. The adapter also passed a live end-to-end
test with an app-scoped token and `fly-domain-test.primo.page`: customer attach,
DNS instructions, pending-to-live status, HTTPS content/uploads, restart
persistence, and switching domains from the existing dashboard dialog.

The smoke app's temporary token expires at `2026-10-05T22:39:29Z`. New attachments
and status checks require a valid token; already-issued certificates and serving
do not depend on that Primo API token. Before customer rollout, implement token
renewal and old-certificate cleanup, and complete the live provisioning/claim
deployment gates described in [hosting/README.md](hosting/README.md).
