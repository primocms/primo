# RC.7 disposable hosted handoff

This QA layer executes the previously prepared checks against a **new, dedicated Railway project**. The user authorized disposable staging deployment and test-page publication after the preparation phase. Production operations, package/registry publication and merging remain excluded. Every release PR stays draft. No product source or frozen RC artifact is changed by these tools.

Use the existing authenticated Railway CLI. Create a unique project named `primo-rc7-qa-YYYYMMDD-<six hex characters>`, a fresh `disposable-rc7` environment and a new local run folder **beside** `release-candidates-rc7`. Never link an existing production project, copy its variables, duplicate its database, attach its volume or reuse its credentials. Explicitly select the new project/environment/service IDs for every subsequent provider operation; adding services changes the CLI's linked service.

The run has one CMS instance (1 vCPU / 0.5 GB RAM), a private-SMTP capture inbox with authenticated HTTPS viewer (0.25 vCPU / 0.25 GB), and a separate empty restore target (1 vCPU / 0.5 GB, separate volume). These are test resource limits, not a hosting recommendation. Record the actual region, deployment/image IDs, metrics and native hashes. Dispose of only these newly created resources after collecting evidence and completing all workloads.

## Exact package and image provenance

`candidate.json` in `../launch/` pins native run 38962963117, CMS source `8e94fb051ec22b7a0335130ed98c6e4c14e1f1f3`, CLI `0.3.0-rc.2` and MCP `0.1.11-rc.2`. Runners compare every installed CLI/MCP file with its original archive; they execute the built CLI and the actual MCP protocol server. They never fall back to sibling source checkouts. This operator runner uses the frozen macOS ARM64 native binary for local CLI configuration and Node 22.13.0 or 24.x; hosted services use the original linux_amd64 binary.

Prepare an empty Docker context, without rebuilding the executable:

```sh
node tests/staging/hosted/prepare-context.mjs --native /path/to/frozen/primo_linux_amd64 --output /new/private-run/build-context
node tests/staging/hosted/prepare-context.mjs --native /path/to/frozen/primo_linux_amd64 --output /new/private-run/build-context --run
```

The first command validates only. The second refuses to overwrite an existing directory and copies only the verified executable, pinned image/config templates and nonsecret provenance. The remote verification stage checks `native.sha256`, then the runtime copies that exact file. Preserve the `primo: OK` build result and provider deployment/image mapping. The deployed CMS is never built from this QA branch. No SSH account key is needed to establish this build provenance.

Set the new service's production-mode environment using `../launch/server.env.example`. Generate test-only bootstrap superuser/developer passwords privately; send secret values through CLI stdin, not command arguments or logs. These bootstrap settings are runtime variables, not Docker build inputs. Attach a **new** volume at `/data`; use the provider's own HTTPS domain on port 8080. Keep the limiter enabled, development auth disabled and telemetry off. All requests retain normal TLS verification.

## Proxy identity is required for real hosted editing

The original local browser tests used loopback hostnames, which intentionally disable editor realtime subscriptions. A real provider hostname exposed subscription HTTP 400 responses because the default PocketBase configuration bound the SSE client to one internal proxy IP, while a subsequent POST arrived through another proxy peer.

For this edge-only Railway test target, configure [railway-pocketbase-settings.example.json](railway-pocketbase-settings.example.json) through PocketBase settings. Railway supplies `X-Real-IP`; PocketBase supports selecting trusted proxy headers. Only use this configuration when the provider owns that header and the application has no direct public TCP ingress. Keep rightmost selection and never enable blanket trust in user-supplied forwarded headers. Sources: [Railway request-header specification](https://docs.railway.com/networking/public-networking/specs-and-limits), [PocketBase reverse-proxy guidance](https://pocketbase.io/docs/going-to-production/#using-reverse-proxy).

`realtime.mjs` captures the failure, applies this setting **only to the named disposable target**, verifies successful subscription, and sends deliberately different forged client headers to prove that the provider still supplies a stable visitor identity. It verifies the limiter settings are unchanged. `TestRealtimeProxyClientIdentity` adds four local regressions: missing configuration fails, the trusted edge identity survives peer changes, untrusted forwarded-for is ignored, and a genuinely different visitor remains rejected. This fixes staging configuration; it does not remove PocketBase's IP-binding protection or change the product binary.

## Private run state

Provider provisioning records are kept outside the repository. `state.json` contains:

- `projectName`, `projectId`, `environmentName: "disposable-rc7"`, `environmentId`, `serviceId`, `cmsOrigin` and a unique `environmentMarker`.
- `mailServiceId`, `mailOrigin`, `mailSmtpHost` for the separate capture service.
- `restoreServiceId`, `restoreOrigin` for a separate **empty** service and volume.

Use only the actual IDs/URLs returned for the project you just created. Store `private/bootstrap.json` with `adminEmail`, `adminPassword`, `builderEmail`, `builderPassword`; `private/mail.json` with capture `username`/`password`; and `private/restore-bootstrap.json` with the fresh restore `email`/`password`. Directories must be mode 0700, credentials/configs mode 0600. Never commit these files. The built CLI receives tokens through a unique throwaway HOME token store per invocation, avoiding process-argument disclosure and parallel token-store races.

The capture service uses the pinned vendor Mailpit image recorded in the execution report. Configure UI/API basic auth **before** publishing its HTTPS viewer. SMTP stays private, accepts only `@primo-qa.invalid` recipients, disables relay/forwarding and never sends real external mail. Capture SMTP proves application delivery and link formation, not ordinary provider SMTP AUTH/TLS, sender reputation or inbox deliverability. [Vendor configuration](https://mailpit.axllent.org/docs/configuration/runtime-options/) and [UI authentication](https://mailpit.axllent.org/docs/configuration/http/) describe these options.

## Execute against the owned target

All hosted runners require both `--run-directory /private/run` and `--run`; there is no implicit network execution. Their state guard accepts only the dedicated project naming/environment/origin contract. Node's built-in modules and the already installed frozen packages are sufficient; Playwright comes from the kit's locked tooling. Do not place the run folder or credentials inside the sealed kit.

```sh
node tests/staging/hosted/seed.mjs --run-directory /private/run --run
node tests/staging/hosted/realtime.mjs --run-directory /private/run --run
node tests/staging/hosted/handoff.mjs --run-directory /private/run --run
node tests/staging/hosted/invite-ui.mjs --run-directory /private/run --run
node tests/staging/hosted/workflow.mjs --run-directory /private/run --run
node tests/staging/hosted/permissions.mjs --run-directory /private/run --run
node tests/staging/hosted/browsers.mjs --run-directory /private/run --run
node tests/staging/hosted/cache.mjs --run-directory /private/run --run
```

- **Seed:** actual CLI init/new and actual MCP scaffolding/validation; ten synthetic agency sites with five block instances each, nested repeaters, scoped editors and non-rendered `qa_scratch` fields. The first site uses the public provider hostname; others use explicit site-preview routes. Initial guarded overwrite is used only after proving the new synthetic target has no pages. Completed seeding refuses to replace existing private configuration.
- **Realtime/handoff:** captured SMTP invitation and exact HTTPS setup form; synthetic token redemption through the auth API; client edit/repeater reorder/save/reload; complete ID/leaf-value retention; CMS browser-compiler and built-CLI publication; live public hydration/interaction. Setup-token redemption is an API step, not a claim that the password form was submitted by GUI automation. Each rerun creates a fresh synthetic handoff client.
- **Browser invitation acceptance:** a separate fresh client follows its real captured-mail HTTPS link, fills both password fields, submits Create account, is automatically signed in, opens its scoped editor and stays signed in after reload. This does not touch any canary.
- **Workflow:** separate non-soak site for two scoped pulls, unmanaged-note preservation, source-only push with stable IDs, stale-push rejection preserving both remote content and local code, then publication from authoritative server data. This never imports over a reserved soak canary.
- **Permissions:** source/schema/role escalation and cross-tenant writes must fail while records remain unchanged. Negative writes target non-canary fields; unexpected accepted writes are conditionally restored on these synthetic records and fail the test.
- **Browsers:** installed Chrome/Edge plus pinned Playwright Firefox; two editor tabs receive edit/restoration by realtime without reload, plus public interaction and original SSR nodes at 390/768/1280px. These viewport cases do not replace physical mobile hardware. An isolated Firefox runtime can be downloaded into the run folder; no user browser profile is used. Use `--only-browser Firefox` for a runtime-only retry; the report retains previous browser results.
- **Warm cache:** temporarily change only the synthetic block's source CSS as its developer, publish as its trusted editor, reload the same browser cache, verify new asset version/style and HTTP revalidation, then conditionally restore source and republish. Content/soak canaries are not imported or overwritten.

Start the long workload **after** the handoff has updated any test-user credentials and the proxy/deployment configuration is final:

```sh
node --env-file=/private/run/private/actors.local.env tests/staging/launch/soak.mjs --config /private/run/private/staging.local.json --profile edit --run
```

The ten scratch records are exclusive. Never run content dialogs or whole-site imports over them while the workload is active. Cross-tab tests edit a distinct non-canary heading, source-only import tests use a separate site, and source-cache tests patch source only. The workload lasts one hour by default, explicitly paces authentication and restores its own values. Keep `criteriaConfirmed:false` until the owner accepts the proposed profile; even a successful hour then reports `PASS_REHEARSAL_ONLY`. Preserve actual measured values so acceptance need not be inferred. See the [soak runbook](../launch/SOAK-RUNBOOK.md) for request bounds, interruption, non-atomic cleanup and recovery limits.

## Native backup and separate restore

```sh
node tests/staging/hosted/backup.mjs --run-directory /private/run --run
```

This requires a separate fresh empty restore target; it refuses the primary origin/service or a nonempty copy. Create a native backup of the owned staging dataset, download it privately, inspect a read-only temporary copy of `data.db`, upload it to the empty target and use the native restore API. Compare ten relevant tables, every expected ID/binding/value, client authentication and active publication. A fresh native snapshot of the restored copy compares the complete storage hash inventory, including metadata sidecars, before public-file downloads verify accessible compiled assets. Sidecars intentionally have no public download URL. Check that the original archive hash remains unchanged. The workload on the source is not stopped; the checkpoint can legitimately contain mid-run canary values, which are compared with the actual backup snapshot. Before exporting, the runner verifies that all sites are the exact generated agency/workflow set, all accounts use reserved test email addresses, mail has no external credentials and both S3 stores are disabled. If verification fails after a successful restore, `--verify-existing-restore` resumes verification only from the original private archive/hash; it never re-restores a nonempty service. No real user data is used or replaced. This synthetic restore does not clear the representative legacy/customer fixture gate.

## Actual Safari on a disposable CI runner

The optional `RC7 hosted Safari public probe` workflow accepts only a public fixture configuration (`environmentId`, `cmsOrigin`, `cmsProbePath`, `publicPages`). It rejects credentials, a foreign public origin and non-provider CMS origins; the ordinary target probe then verifies the unique fixture and production mode. Manual dispatch on this draft branch runs native Safari on a fresh macOS 15 runner. Enabling WebDriver affects only that disposable runner, using [Apple's documented setup](https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver). It does not change the operator's Mac, Safari preferences or personal profiles. [GitHub's runner inventory](https://github.com/actions/runner-images) records the installed Safari version; retain the actual capabilities returned by the run.

The public-only dispatch needs no credentials and does not edit or publish. The optional `editor:true` step requires explicit authorization to provision a temporary site-only QA account and a new encrypted Actions secret named `PRIMO_RC7_QA_CE4FC8_SAFARI`. No existing secret may be overwritten. Its JSON must contain `cmsOrigin`, the exact `environmentId` marker, a freshly generated `safari-ci-<hex>@primo-qa.invalid` email/password, and its `userId`, `siteId`, `sectionId`. The helper independently verifies the origin, marker, reserved account, single editor membership and completed scratch baseline before any editor mutation. Never transfer administrator or real-user credentials.

The editor step uses native Safari form/keyboard/repeater controls, checks save/reload identities and leaf values, publishes through the frozen server's browser compiler and tests public interaction. It conditionally restores original content and indices, closes its isolated session and explicitly requests a final local exact-CLI cleanup publication if it activated a test build. Run it only after the source soak is complete and without other writers. Immediately delete only the newly created secret and temporary QA account after collecting evidence. This optional step remains NOT_RUN until its credential transfer is approved; a public Safari pass does not clear the full editor or physical-device gate.

## Evidence and release gates

Execution JSON/screenshots and redacted CLI logs are separate from private credentials, mail bodies, backups and raw logs. Review before sharing. Keep all private files out of PRs, artifacts and reports. Record the final soak restoration, resources/metrics and teardown of only the newly created project. The original sealed RC.7 archive and prior PR heads remain unchanged.

Actual Safari public testing can use the disposable CI runner above. Its complete editor handoff needs approval for the temporary CI credential, or an unlocked accessible Mac/existing enabled WebDriver endpoint. Physical iPhone/Android need devices or a device service. Capture mail cannot prove external deliverability. Representative legacy data needs an owner-sanitized backup. Device floors and performance acceptance remain owner decisions. No partial probe implies a full cohort-launch GO.
