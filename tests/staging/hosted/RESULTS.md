# RC.7 hosted staging execution

Executed October 16–17, 2026 UTC, entirely in a newly created disposable Railway project with generated test data. User authorization covers staging deployment and test-page publication. No production operation, merge, registry/package publication, tag or release occurred. Existing release PRs remain draft.

## Candidate and environment

CMS `v3.3.2-rc.7`, source `8e94fb051ec22b7a0335130ed98c6e4c14e1f1f3`, original native run `38962963117`; CLI `0.3.0-rc.2`; MCP `0.1.11-rc.2`. Exact archives and every installed package file were checked before executing the built CLI and actual MCP server. Hosted Linux executable SHA-256: `7ef3f290e3555933037cb2be8edba77b6691f81e9672d6b60de3ef9f0db30c60`. The remote image build independently reports `primo: OK` and copies the verified executable without rebuilding it. The sealed RC.7 kit remains SHA-256 `79b35ec5ffcc22c180e56688328ea686aa1f9d28e68fe3ddefc94d5e41e83462`; this QA branch is not a new RC.

Primary service: one replica, 1 vCPU / 0.5 GB RAM, US East; separate persistent volume. Production validation and rate limiting enabled, development auth disabled, telemetry off. Dedicated private SMTP capture and separate empty restore service have independent test resources. Domains are provider-owned HTTPS domains; no custom-domain/DNS/ACME claim is made.

## Verified results

| Check | Result and evidence scope |
| --- | --- |
| Actual init/build/publish | Built CLI init/new, packaged MCP protocol scaffolding/validation, ten agency sites with five block instances and nested repeaters each, guarded first push and actual publication pass. Deep schema files are authored and validated after the MCP shallow scaffold. |
| Content-only client handoff | Actual captured invitation link/form, scoped client edit, root and nested repeater reordering, Save/reload, stable IDs/bindings/leaf values, browser compiler and exact CLI republication, public HTTPS rendering and counter interaction pass. |
| Complete browser invitation | Separate fresh client follows real captured-mail HTTPS link, fills and submits Create account, auto-signs in, opens its five-block editor and stays signed in after reload. Capture-only mail never leaves the test project. |
| Synchronization/conflicts | Separate eleventh site: two scoped pulls preserve unmanaged notes and IDs, source-only push preserves content, stale push is rejected with both remote edit and pending local source retained, authoritative publication passes. |
| Permission boundaries | Own HTML source/schema writes receive 403; server-role escalation and foreign writes/read receive 404. Records remain unchanged. Editors retain the previously accepted trusted publication capability, including compiled executable uploads; this is not an untrusted-code sandbox. |
| Real desktop browsers | Chrome 155.0.8059.84, Edge 155.0.4283.45, Firefox 155.0: inline edits propagate to another editor tab by SSE without reload; public interaction, five original SSR headings and no horizontal overflow at 390/768/1280px pass with zero page errors. Viewports are not physical-device evidence. |
| Actual Safari public page | Native Safari 26.6.1 on disposable macOS CI passes HTTPS marker/headings, native counter click, DOM retention during interaction, no overflow and reload; session closed. [Run 38987276088](https://github.com/primocms/primo/actions/runs/38987276088). This is public-only and does not clear editor, initial SSR identity or mobile hardware gates. |
| Actual Safari editor | Safari 26.6.1 / macOS 15.7.9 passes native sign-in, keyboard edit, root/nested reorder, stable IDs/leaf values, Save/reload, browser publication and public interaction; three further independent sessions load all five editable blocks. Every case restores original data and closes its session. [Final run 38992361437](https://github.com/primocms/primo/actions/runs/38992361437). Temporary CI secret/account/role removed and final exact-CLI cleanup publication/pull pass. |
| Ingress and warm cache | HTTPS, configured security headers, public Last-Modified/304, actual `_site` preview no-store pass. Same browser retains cache across a client republish, receives changed CSS and asset version, revalidates old Last-Modified with 200 and remains interactive; source is restored and republished. |
| Synthetic native restore | Native backup restored into a distinct fresh RC.7 service without interrupting source workers. Ten tables match, including 11 sites/pages/page types, 55 sections, 77 fields, 605 entries, 12 role assignments, 13 users and zero uploads. All 144 stored files/metadata match; 36 compiled-file downloads match. Client auth and restored active publication pass. This snapshot predates a later additional invitation-only client. |
| Automated regressions | 29/29 staging tools on Node 22.13.0 and 24.0.0; complete Go suite passes, including four reverse-proxy identity cases; Svelte check has zero errors and zero warnings. |
| One-hour ten-editor workload | 3,760.58 measured seconds, 3,291 cycles, 16,455 workload requests, zero errors, all ten original scratch identities/values restored. p95 public 108.08 ms; save/readback 770.90 ms. Provisional limits met; status remains PASS_REHEARSAL_ONLY because owner criteria are unconfirmed. This is API/content capacity, not ten concurrent GUI compilers. |
| Uploaded image lifecycle | Content-only PNG upload and exact-CLI publication, same-record replacement with a new filename and verified new bytes, retired-file 404, then owned-image deletion and cleanup publication all pass. |

## Finding fixed in staging configuration

Real hosted editor subscriptions initially returned HTTP 400: the GET and subscription POST reached different internal proxy peers, while PocketBase's default identity used the TCP peer. Localhost tests had intentionally disabled realtime subscriptions. Trusting only the provider-owned `X-Real-IP` on this edge-only target resolves registration to 204, including forged-header probes, and preserves the production limiter. Two-tab tests prove actual event delivery in all three desktop browsers. Four Go regressions retain rejection for a genuinely different visitor and ignore untrusted forwarded-for. No product executable was changed. Other deployments must explicitly configure their own trusted ingress; do not assume this Railway setting is universal.

The harness was corrected to pace ten account logins within the production limiter, test the actual `_site` preview contract and handle native storage metadata sidecars through snapshot comparison. Backup export initially paused under automatic review; read-only checks and enforced guards established that every site/account and destination was generated in this run, with no external mail/storage credentials. The reviewed retry was approved. Raw backups, authentication records, passwords, mail bodies and token stores remain private and are excluded from shared evidence.

## Remaining launch gates

- Physical iPhone/Android handoff and supported browser/OS floors. Actual Safari 26.6.1 on virtual macOS now passes; this does not attest mobile hardware or older Safari. The local Mac control connection timed out even after the user unlocked it; no personal browser settings were changed. Its Playwright WebKit runtime also failed a neutral blank-page probe. These local environment failures do not replace the successful native Safari CI evidence.
- Representative sanitized legacy/customer backup and expected values/history. Synthetic snapshot and earlier synthetic upgrade evidence are insufficient for this gate.
- Ordinary external SMTP AUTH/TLS, sender configuration and actual inbox delivery. Private capture proves application mail and invitation acceptance only.
- Custom-domain DNS/ACME lifecycle and external CDN behavior, if included in the release promise. Only provider-domain TLS and same-origin cache behavior have been exercised.
- Owner acceptance of supported device/version floors and workload/performance criteria. The full-hour result must remain rehearsal-only until criteria are accepted.
- Public-registry install remains intentionally unrun because package publication is prohibited; exact frozen archives were used instead.

Recommendation remains **NO-GO for the full ten-customer launch** until the applicable blocked gates are cleared. Successful hosted engineering checks do not substitute for these decisions or missing fixtures.

## Safari harness and retained initial failures

The first Safari editor attempt timed out. Three independent load cases then captured two failures back at `/admin/auth`, with an empty auth store and no editor frames, plus one success. The test had accepted any intermediate `/admin` URL and immediately forced a new document navigation. It now waits for the final one-site dashboard and follows the native site link; a mock regression exercises intermediate redirects, an empty dashboard and a foreign-link refusal. The final full handoff and three fresh all-five-frame loads pass without changing the frozen product. The earlier failures remain in the evidence; the original historical #1235 stall fixture is still unavailable, so that issue is not closed.

One initial Firefox source-CI run had a page-process crash (41/42 tests passed); the subsequent three-engine source run passed 42/42 per engine without product changes or retry masking. Keep the failed trace private as a remaining intermittent-engine risk. Current-head CI is recorded separately; do not infer success from an in-progress run.

## Resource and access cleanup

The new synthetic Safari account, its one site role and the new encrypted GitHub Actions secret were deleted and removal verified. The separate restore service and its newly created unattached volume were removed after successful verification. The primary disposable staging server and protected capture inbox remain available for the outstanding device/integration checks; provider resource usage continues. They hold generated QA data only. No other provider project or production environment was changed. Native backups and raw logs remain private; shared evidence excludes them.

Review this QA layer after draft #1342 (staging preparation), which follows #1340 (frozen exact-package QA) and #1339 (RC.7 integration). Review MCP/compiler and CLI dependency changes before CMS integration and QA evidence. With future release authorization, publish the approved MCP first, make the compatible CMS available before the public CLI, then publish the CLI and verify a fresh registry install. Rebuild and rerun exact-package checks after any package byte/version/reference changes. No existing PR head or release artifact is changed by this layer.
