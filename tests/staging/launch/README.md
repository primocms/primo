# RC.7 staging preparation

This is a QA preparation layer for the frozen RC.7 packages. It creates no server, sends no mail, installs no apps, and cannot publish, merge or deploy. These tools perform only the checks named below. Hosted execution after explicit staging authorization is documented in [the hosted runbook](../hosted/README.md); it uses the same frozen product packages. Keep the release PRs in draft.

Start with [ACCESS-CHECKLIST.md](ACCESS-CHECKLIST.md). Use [FIXTURE-CHECKLIST.md](FIXTURE-CHECKLIST.md), [DEVICE-CHECKLIST.md](DEVICE-CHECKLIST.md) and [SOAK-RUNBOOK.md](SOAK-RUNBOOK.md) to supply and record the missing evidence. A script result clears only the checks named in that result.

## Candidate and environment

[candidate.json](candidate.json) pins CMS **v3.3.2-rc.7**, source **8e94fb051ec22b7a0335130ed98c6e4c14e1f1f3**, native build run **38962963117**; CLI **0.3.0-rc.2** and MCP **0.1.11-rc.2** archives. The preparation code does not change or rebuild those packages. Node **22.13+ within 22.x**, or **24.x**, is supported; the regression matrix uses 22.13.0 and 24.0.0.

[server.env.example](server.env.example) describes an **already-running, disposable** production-mode server. It is a reference, not a deployment script. `PRIMO_APP_URL` seeds the initial PocketBase settings migration; on an existing server, also verify the actual application URL in PocketBase settings. Set mail through PocketBase settings, not invented SMTP environment variables. Do not apply this example to production. Leave Railway credentials absent unless that optional provider gate is in scope; [railway.env.example](railway.env.example) lists only the required staging inputs.

The target must already serve the marked synthetic fixture described in the fixture checklist. Preparing or publishing that fixture on external staging is a separate future action. Without an existing fixture, the runner blocks before authentication. This requirement deliberately prevents accidentally pointing an edit run at an unrelated server.

## Configure locally without contacting anything

From this directory, copy the examples, then fill the local copies:

```sh
cp staging.example.json staging.local.json
cp fixture.example.json fixture.local.json
cp secrets.example.env secrets.local.env
chmod 600 staging.local.json fixture.local.json secrets.local.env
```

Keep local files and `.runs/` outside the frozen RC kit; they are ignored by Git in this directory. Obtain secrets through a private channel or your local secret manager, never in a PR or chat. The programs read environment variables and do **not** load `.env` files. Export the named variables using your normal secret-loading mechanism, or ask Node to load the reviewed local file, for example `node --env-file=secrets.local.env soak.mjs --config staging.local.json --profile edit` (still a plan unless `--run` is added). Never print their values. If sourcing a local env file, review its shell syntax first and export its assignments.

Fill `environmentId` with a fresh 12–100 character identifier, `cmsOrigin` with the exact HTTPS origin, and `cmsProbePath` with the marked `/?_site=<15-character-QA-site-ID>` preview path on that origin. Public URLs must be real host-routed pages without `_site`; preview responses intentionally use `no-store`. `publicPages` must list only QA pages (five expected headings per page). No URL may contain credentials. Plain HTTP is accepted only on loopback for local rehearsal. Set `.physical` true only when the selected session actually uses the attested physical device. Resolve capability placeholders and `$env` references locally.

All these commands default to **zero network requests**, even with otherwise valid inputs:

```sh
node preflight.mjs --config staging.local.json
node fixture.mjs --config fixture.local.json
node device.mjs --config staging.local.json --device mac-safari
node soak.mjs --config staging.local.json --profile read
node soak.mjs --config staging.local.json --profile edit
```

Exit **0** means a valid plan, not execution; **2** means missing/invalid configuration. The shipped examples must report blocked until supplied. Help is available with `--help`.

## Checks after access is supplied

The first two commands below read only. Inventory hashes the supplied backup without extracting or migrating it. Binary attestation hashes a file without executing it:

```sh
node fixture.mjs --config fixture.local.json --run
node attest-binary.mjs /path/to/original-running-service-binary linux_amd64
node preflight.mjs --config staging.local.json --run
node device.mjs --config staging.local.json --device mac-safari --run
node device.mjs --config staging.local.json --device iphone-safari --run
node device.mjs --config staging.local.json --device android-chrome --run
```

Use the actual native target from `candidate.json` for attestation. An HTTP version string is insufficient to prove executable provenance. Supply the running service's binary hash plus its mapping to the service/container. Container image digests require that mapping too; these are raw executable hashes, not image or archive hashes.

Preflight checks the unique anonymous marker before accessing `/api/primo/info`, verifies RC.7 production mode, and checks public cache/security headers, 304 revalidation and preview `no-store`. It never logs in, sends mail, creates an invitation, changes DNS or publishes. Domain-specific CDN lifecycle, ACME renewal and actual mail delivery remain manual/access-dependent gates.

Device probes connect to an **existing** W3C WebDriver endpoint. Local Safari requires the operator to enable and make Safari automation available independently; this script never changes that setting. Real iOS/Android require an existing browser-capable device service (for example an Appium endpoint) with operator-provided capabilities. Provider-specific options may be added by the operator; omit app installation, automatic permission grants, alert acceptance and insecure-certificate bypass. Endpoint URLs and provider credentials stay in environment variables. Use a provider idle-session timeout: if session creation times out before returning its ID, the client cannot identify that session for deletion.

[SOAK-RUNBOOK.md](SOAK-RUNBOOK.md) defines rehearsal and bounded edit runs. The edit profile changes only reserved synthetic `qa_scratch` values and conditionally restores them. Read it before adding `--run`.

## Evidence and limits

Executed checks write unique JSON files with mode `0600` under the configured output directory (created with mode `0700`). A failed check exits **1**; configuration/local evidence failures exit **2**. Do not upload local configurations, secrets, raw backups, unsanitized server logs or device-provider responses. Review evidence before sharing: fixture inventories include file paths, and device evidence includes the expected synthetic headings. Treat screenshots and browser traces as potentially containing account data.

| Result | What it proves | What it does not prove |
| --- | --- | --- |
| `READY_NOT_RUN` | Configuration is complete | Any network or product check |
| `PASS_INVENTORY_ONLY` | Owner-supplied backup checksum matched | Sanitation, valid archive, migration, database counts |
| `PASS_BINARY_BYTES_ONLY` | Local binary bytes match RC.7 | That these bytes are running on staging |
| `PASS_READ_ONLY_PREFLIGHT` | Current marked responses and selected headers | SMTP delivery, DNS lifecycle, CDN invalidation after publish |
| `PASS_PUBLIC_SMOKE_ONLY` | Selected browser rendered/interacted/reloaded | Physical hardware verification, editor handoff or republish |
| `PASS_REHEARSAL_ONLY` | Short/read-only workload met its limits | Ten-editor capacity gate |
| `PASS_SOAK` | Confirmed bounded ten-editor draft workload met its criteria | Full publishing capacity, production SLA, final release GO |

Run the local regression suite from the repository root after installing its locked dependencies:

```sh
node --test tests/staging/launch/test/*.test.mjs
```

Tests use temporary fake data and loopback mock CMS/WebDriver endpoints. They are **tool regressions**, not proof of actual Safari, physical-device, representative-backup or external-staging coverage. The dedicated CI workflow repeats them on both supported minimum Node versions without service secrets.
