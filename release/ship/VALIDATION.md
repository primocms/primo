# RC.12 validation status

Prepared for review, not GO for publication/deployment. RC.12 changes product bytes; RC.11 results are historical. The current review target is [CMS #1363](https://github.com/primocms/primo/pull/1363).

## Local consolidation evidence

- Node 24.22.1: source/type/Svelte check passes with zero errors/warnings; all 140 integration tests pass with zero skips.
- Shared validation and production frontend builds pass. Existing chunk/cycle warnings and upstream Zod annotation warnings remain recorded in build output; they are not source-check warnings.
- Go 1.26.9: full server and migration suites pass, including the added direct-reorder content/design boundary regression.
- All 27 compiler/component Chromium regressions pass with zero skips, including independent published hydration/head identities and delayed repeater preferences under the merged locale/scoped-storage implementation.
- The first consolidated native/frontend build passes all 49 Chromium workflow tests with zero retries/skips, including publication, transactional drag/menu/save retry and content-only nested reorder/source denial. After rebuilding the final source, all 8 publication/repeater workflow tests also pass, including the latest #1362 real-browser escaping regression, repeat publication, empty-page metadata, drag/menu/save retry, and content-only nested reorder/source denial.
- CLI and MCP vendor archives retain SHA-256 4d4dea80ac9bd3a3c4bc6721bd6320d83833f4c2ac6731148c0bc1be63349483 and a7c32c82bc748b18cc694782493112937aec86c86cc056b407ab1a8e8b7c0a03 respectively. Their shipped bytes are unchanged.

Initial failures were integration fixtures, not waived assertions: the generated SSR module now supplies render; the repeater fixture needs locale, scoped storage and a minimal real manager shape. These harnesses were updated and rerun. No retries, skips or enlarged timeouts were added. Full local browser workflows use generated loopback data and captured/disabled mail; no external site is published.

## Security and final-head gates

A fresh npm audit on 2026-10-25 initially found 4 high, 1 moderate and 5 low findings. Compatible lock refreshes remove all high/moderate findings. Final audit: **5 low, 0 moderate/high/critical**. The remaining SvelteKit-path advisories are [enhanced-form redirection](https://github.com/advisories/GHSA-pfhg-q3qv-9q6r) and [prerender cache-control XSS](https://github.com/advisories/GHSA-27mw-82g8-phjj), propagated through adapter-static/runed/bits-ui/svelte-toolbelt. npm recommends a framework major upgrade. That upgrade is deferred rather than forced without compatibility qualification. These findings require resolution or an explicit reviewed disposition before shipping; this preparation does not accept them on the maintainer's behalf.

The strict npm audit job is unchanged in severity policy and remains a failing shipping gate. It runs independently from native builds so a finding does not prevent collection of native/browser evidence. Do not interpret green non-audit jobs as an all-green release.

Final PR-head five-platform, exact-package, Firefox/WebKit/Safari, copied-recovery/framing, security and current CLI/MCP/hosting audit qualification remain required. Initial b423e9a CI failures include the retained audit findings and then-fixed browser fixture; only the final head counts. Historical RC.11 product 5642f312bd29b83dea7ed3c86c68581ad52c5db3 / QA 91ff71f82a7c276b609a6d861e22c48ef536c7d4 results in #1351–1353 do not qualify RC.12.

## Deferred external gates

MCP-first registry publication/final stable locks and exact final-package requalification; RC.12 hosted purchaser/ingress/realtime/mail; selected host/support/recipients; first-client devices/domain/operations; representative fixtures for actual migrations. Publication-dependent gates cannot pass under the current no-publication instruction.
