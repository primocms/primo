# Founding-builder release scope

Prepared 2026-10-25. This is the current release contract; release/rc8 documents remain historical. No merge, tag, publication, deployment, live mail or invitation is part of preparation.

## Audience and versions

Supervised ten-builder pilot for new sites and desktop editing, with operator-provisioned site-scoped developer and content-editor roles. Proposed stable versions: CMS 3.3.2, CLI 0.3.0, MCP 0.1.11. Candidate versions: CMS 3.3.2-rc.13, CLI 0.3.0-rc.3, MCP 0.1.11-rc.3. Final version changes require new artifacts and verification.

Publishing RC.13 uses the candidate versions above. Stable renaming/native
qualification and real-customer rollout gates belong to later promotion. See
ROLLOUT.md's prerelease path for the exact npm `rc` channel, tested binary
handoff, stable-channel preservation and final public-install checks.

## Included

- Cumulative RC.11 CMS product and latest QA: guarded synchronization, nested field/content identities, content-only source permissions, production validation, independent hydration/head identity, cache/security headers, supported runtimes, same-origin framing, compiler lifecycle/recovery, presence/reload/save recovery, managed purchaser bootstrap and owner-only access.
- Current main at INPUTS.json's SHA, retaining transactional repeater ordering/ancestor values (#1359), browser publication/snapshot preservation (#1360), authenticated streaming recovery snapshot uploads (#1361).
- The reproduced inline hydration-prop script escaping fix and regression (#1362).
- Matching locked Svelte runtime/clsx/devalue modules and licenses are packaged as hashed CMS assets. Compiler core resolution uses these same-origin sources after the upgrade exposed reproducible CDN installation failures/timeouts. Authored non-runtime packages retain their existing resolver. Real timeout/recovery and CDN-blocked publication/hydration assertions remain enforced.
- Existing CLI #67 and MCP #30 candidates and new audited RC.3 archives. Registry preparation remains a later gate.
- Hosting readiness/security #1350, independently reviewed as hosting-only; its older CMS tree is never a CMS release source.
- Authorized security remediation: SvelteKit 3.1, adapter-static 4, Vite 8, TypeScript 6, Svelte 5.57.2, runed 0.38 and Go 1.26.10. CMS source builds require Node 22.17+ or 24; CLI runtime minima remain 22.13 and 24.0. No audit threshold or assertions are weakened.

## Deferred

Unrelated dependency-major automation and the unfinished local plugin/forms experiment remain outside this release. All current feature PRs were authorized for inclusion on October 25 and are listed below.

General cross-origin embedding, hostile-publisher sandboxing, delegated invitations, legacy migration promises, production SLA and broader-scale claims remain outside this pilot. Editors remain trusted publishers of compiled output.

## Identity and gates

RC.13 is a new product identity because the authorized security migration changes RC.12 bytes. RC.11/RC.12 results are historical baseline evidence. Native CI builds and verifies RC.13 from the exact PR head. CLI/MCP hashes remain in tests/staging/rc8-packages.json; the rc8 path is compatibility naming, not the CMS version.

Accepted one-hour ten-editor API/content limits: p95 public <=1 s, save/readback <=2 s, zero errors; this does not attest ten simultaneous browser compilations. Zero data loss, cross-site access and destructive conflict overwrites are required.

Pilot activation needs the final candidate's hosted purchaser/ingress/realtime checks, actual invitation/setup/reset delivery on the selected host, host/support ownership and private recipient-to-site assignments. RC.10 provider/mail and RC.9 pilot evidence are historical. Physical iPhone/Android public-page checks, actual domain/TLS/CDN when used, backup/restore and client handoff gate first-client publication. Representative sanitized fixtures gate actual legacy migrations. Desktop new-site drafts do not imply client-publication authorization.


## October 25 editor and feature reconciliation

The user expanded RC.13 to include all current feature PRs: CMS #1341, #1355–1358 and #1208; CLI #68–69; MCP #31–32; documentation #9–10. These provide mobile layouts, page-list/sidebar fixes, page-type head inheritance, browser-approved CLI login, incremental publication, local-agent logs and the dashboard local-development entry point. Current uncommitted CDFI and dashboard fixes are also included: creation/template-copy lifetime, form drafts, rename/delete/reorder, empty links, stale block movement controls, content/image/inline-text/rich-text stability, section outline lifetime and dashboard navigation/loading. Large site imports include bootstrap, site and library routes with the same bounded request budget. The older worktree domain-change fix preserves published output instead of compiling unpublished drafts.

The prior frozen RC.13 source remains immutable historical evidence. This amended RC.13 revision must pass new source/native/exact-package qualification. The CLI/MCP archives are rebuilt unpublished candidates; their refreshed SHA-256 and integrity values identify the new bytes. Older green CI and the existing QA deployment do not attest these new bytes. No registry publication, main merge, production/QA deployment, email or invitation is part of this reconciliation.

The [worktree inventory](editor-audit/worktree-inventory.json) records all 94 inspected checkouts. Preserved historical checkouts and the unfinished plugin experiment are not independent release inputs. Dependency-major bot PRs are tracked separately from feature PRs and are not silently mixed into this build.

## October 27 proxy-safe pushes (#1354)

The release now includes coordinated CMS/CLI batched archive transport for
site push, preview, bootstrap and both library push entry points. Requests
adapt from 1 MiB down to 64 KiB on proxy 413 responses, with checksum-verified
idempotent chunk retries and a single guarded final import. Private bounded
staging expires and never replaces content before commit. Library archive
expansion now shares the site's 512 MiB budget.

The new real-CMS regression sends a 36 MiB site through a proxy limited to
256 KiB, including a lost chunk acknowledgement, pull/push round-trip, preview,
both library commands, stable asset identities and a client edit between
preflight and commit. Native candidate CI runs this against the bundled CLI.
The amended CLI archive needs fresh candidate qualification; previous green
runs and the existing QA deployment do not attest these bytes.

## October 28 site-field resolution

The release includes consistent owning-site key/ID resolution and publication
preflight diagnostics across MCP, CLI and CMS, plus partial-import key lookup.
Current candidate archives/locks are refreshed. Stable npm package artifacts
are prepared under final-packages/ and remain unpublished. Their manifest
separates offline package verification from pending registry/native/hosted gates.

## October 28 publication readiness

The prerelease path now preserves stable container channels and refuses a
mislabeled release. RC binary releases reuse the five executables that passed
exact-source qualification rather than rebuilding after tests. The final
source also includes main's starter-clone optimization (#1364): reused
validation runtimes and cached field types retain production validation while
reducing repeated work during cloning. New qualification is required after
this integration; earlier hosted evidence stays attributed to its tested source.
