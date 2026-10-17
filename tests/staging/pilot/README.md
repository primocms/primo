# Ten-builder pilot preparation

The user accepted the recommended pilot defaults on October 16, 2026 (America/Chicago). This records a supervised ten-builder pilot for new sites and desktop editing. All PRs stay draft. This preparation sends no email, creates no accounts or sites, changes no running settings, and performs no merge, package/site publication or deployment.

The accepted machine-readable policy is [pilot.defaults.json](pilot.defaults.json). It is an operator worksheet, not a runtime configuration loader. The previously sealed RC.7 product and evidence archives remain immutable. Read the [hosted execution record](../hosted/RESULTS.md) for the existing exact-package verification and its limits; the new user acceptance does not retroactively change the recorded `PASS_REHEARSAL_ONLY` result.

## Pilot scope and readiness

- Ten invited freelancers/agencies, starting with new sites. Builders receive per-site `developer` assignments; their clients receive per-site `editor` assignments. Neither receives server-wide authority. A per-site developer can work on an assigned site; this plan does not claim unrestricted self-service site creation. Provisioning each site remains an operator step in a separately authorized pilot execution.
- Editing is supported on current stable desktop Chrome, Edge, Firefox and Safari. Record actual versions and verify any versions beyond those covered by the RC.7 evidence. Physical-phone editing, older browsers and general external embedding are outside the initial promise.
- Content-only editors may update content/repeater order and publish through the retained trusted compiled-output capability. This does not sandbox an untrusted publisher's executable output.
- Zero silent data loss, cross-site access or destructive conflict resolution. A reproduced failure pauses the affected workflow and prompts recovery from the last verified copy.
- Accept the existing workload limits: ten editors for at least an hour, ten-second worker intervals, p95 public response at most 1,000 ms, save/readback at most 2,000 ms, zero workload errors. These are bounded pilot acceptance criteria, not visual-loading measurements, ten concurrent browser compilers or a production uptime promise.
- The accepted framing default is same-origin, with exceptions approved individually. **Frozen RC.7 still serves `frame-ancestors *`.** This documentation does not implement or apply a header change. Implement and test the accepted policy in the next candidate or approved ingress configuration before client launch, then rerun affected preview/public-page regressions and authorize deployment separately.

Before normal invitations, verify real email delivery through account setup and password reset, identify the pilot host/support contact, check the supported browser versions and per-site developer assignments, and obtain execution authorization. The existing synthetic staging project is a test fixture, not an automatically approved home for real builders or client content. An invitation may still fail while role creation succeeds: `internal/invitation.go` logs delivery failures. For the pilot, the operator must check delivery and support reset/resend; do not treat a role record as proof of receipt.

Before the first real client site goes live, check its published pages on a physical iPhone/Safari and Android/Chrome, the chosen custom-domain/HTTPS/CDN path if used, the accepted framing policy, the full client handoff and backup/support operation on the selected pilot host. These checks can happen while builders create drafts. Obtain the relevant deployment/publication authority separately.

Before importing or upgrading a legacy site, verify a representative sanitized backup, files, expected values/history and migrations on disposable copies. This gate can wait for a pilot restricted to new sites.

## Email credentials to supply

Use a dedicated SMTP sending credential restricted to the provider/project or verified sender used for the pilot. Supply these in a private copy of [email.example.json](email.example.json):

| Field | Supply |
| --- | --- |
| `provider` | Email provider name, for interpreting its settings |
| `smtp.host` | Exact SMTP hostname from the provider |
| `smtp.port` and `smtp.security` | Provider's documented pair: typically `465` / `implicit_tls`, or `587` / `starttls` |
| `smtp.username` | SMTP username; this may differ from the sending address |
| `smtp.password` | Dedicated SMTP password, app password or SMTP-compatible send credential |
| `smtp.authMethod` | `PLAIN` by default; use `LOGIN` only if the provider requires it |
| `smtp.localName` | Leave blank unless the provider requires a specific EHLO/HELO name |
| `sender.name` | Default: `Primo Founding Builders` |
| `sender.address` | Exact provider-verified From address |
| `testRecipient` | One real inbox controlled by the operator |
| `senderVerifiedByProvider` | Set true only after the provider approves the sender/domain |

An SMTP credential is sufficient; no account-admin password, DNS token or full mailbox login is needed for this preparation. The operator can confirm inbox delivery and provide redacted message headers. Start with one controlled inbox; a second provider is useful later, not an invitation gate. Do not commit the populated file or put its contents in chat, PRs, CI secrets or a release kit.

Prefer the provider-supported implicit TLS connection on port 465 when available. With the pinned PocketBase v0.39.7 implementation, `smtp.tls=true` selects immediate TLS; `smtp.tls=false` selects the STARTTLS path. Thus port 587/STARTTLS is **not** mapped to `tls=true`. Actual negotiated TLS and authenticated sending still need verification. `PLAIN` names the authentication mechanism, not permission to send credentials over cleartext.

These fields are worksheet inputs, not automatic environment variables. A later authorized operator action maps them into PocketBase `/api/settings`: `smtp.{enabled,host,port,username,password,authMethod,localName,tls}` and `meta.{senderName,senderAddress}` while preserving the existing application URL and unrelated settings. Existing capture-only mail remains unchanged. Do not export a native backup after inserting real SMTP credentials into staging without a separate credential-sanitization review; the synthetic-only backup guards deliberately reject external mail settings.

`executionAuthorized` remains false. Supplying credentials does not authorize changing the running server, sending test mail, inviting people, publishing or deploying. A later explicitly authorized mail test should send only an invitation and password reset to the controlled test recipient, verify exact HTTPS links/account scope/delivery headers/TLS, and return cleanup and outcome evidence without tokens or passwords.

## Ten-slot onboarding worksheet

Copy [builders.example.csv](builders.example.csv) into a private local file. Collect real builder names/email addresses there when preparing actual invitations; all ten slots begin `NOT_SENT`. Keep private recipient and site mappings out of the repository. [BUILDER-GUIDE.md](BUILDER-GUIDE.md) is the prepared onboarding checklist for each builder; distribution is a later authorized step.

For each slot, a later authorized operator will record the assigned site, scoped developer role and invitation receipt; the builder completes account setup, uses the exact supported CLI/MCP packages, builds a draft, exercises a local/remote conflict and hands a site to a separate content-only client. Verify that client's edit, repeater reorder, save/reload and authorized republish preserve all IDs/values. The first-client gate stays `NOT_CLEARED` until its device/domain/framing/backup checks pass. Public registry installation and live publication remain separately authorized gates; exact archive evidence does not prove a future registry release.

No regression tests are added for these documentation/data templates. Validate JSON/CSV shape, ten blank scoped slots, private-file permissions, and a diff containing only preparation documents. Product code and existing test expectations are unchanged.
