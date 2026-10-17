# Integration review record

This records agent code review of the frozen input set and final integration delta. It is not an independent maintainer approval or permission to release. At the input snapshot, all 27 historical PRs were open drafts with unchanged heads; no submitted reviews or inline review comments were present.

## Findings and disposition

| Finding | Disposition |
| --- | --- |
| Multiple overlapping release/QA histories make serial merging unsafe | One consolidated CMS change on current upstream; its initial tree was verified identical to the complete draft input. Existing CLI #67/MCP #30 remain unchanged package inputs. Preserve historical PRs; do not merge duplicate candidate chains. |
| Accepted same-origin framing policy was not implemented in RC.7 | Implemented for public/preview responses, retaining static-preview script blocking and cache behavior. Go header/static-preview/304 regressions fail before the policy change and pass afterward. Actual same-origin iframe content remains visible; a different-origin parent cannot display it. |
| Native builds and browser checks could otherwise exercise different bytes | Native workflow builds once on five platforms and records source/version/hash plus production publication checks. Dependent three-engine jobs download and verify those exact Linux bytes and every installed CLI/MCP file before and after full suites/handoffs. Final local manifest pins the tested artifact identity. |
| Recovery cannot be proved by starting an old executable against upgraded data | Production-mode disposable rehearsal upgrades one copy, restores a separate pristine-backup copy with RC.7, checks ten record collections, nested values/bindings, image bytes, active publication, client auth and source denial, then confirms a newer candidate write remains in its separate copy. |
| Initial recovery inventory was denied when reading publication internals as an ordinary owner | Expected product boundary, not a product failure. The harness now uses its generated local superuser for protected inventory only; owner/client operations retain their own credentials and denials. Product permissions were not weakened. |

Additional first integration-run findings: Node reports `x64` while artifact names use `amd64`; the recovery guard now normalizes the alias while retaining exact prior-binary hash rejection. The Firefox trace showed the new framing check stalled only while querying a CSP-blocked child automation context. It now uses a positive-control image request to prove allowed rendering and its absence after the blocked frame load, avoiding that unavailable context without weakening the same-origin/header assertions. An unchanged invitation-navigation test also experienced a Firefox page-process crash; retain the failed trace and check whether it recurs in the final complete run, without blanket retries or changing its assertions.

The next WebKit source trace explicitly reports a network-process crash (including the clone request, status -1); the independent frozen run completed its packaged handoff but lost the collaborator dashboard during the suite. Deliberate blocked-frame probes now run in a separate Chromium job/process with their own disposable server/database. All original positive-control/header/refusal assertions remain there. The complete normal workflow suites retain all 42 existing cases plus a same-origin preview case in each engine; no adversarial fixture or broken canary image enters their shared browser/database. Normal workflow assertions and timeout budgets remain unchanged, and no retry/skip is added. Treat initial engine failures as retained evidence, not successful checks.

The scoped-onboarding probe confirms that new user and role creation remains operator-only. Document operator-managed client invitations for the supervised pilot; do not weaken account rules or introduce delegated invitation capabilities in this release.

## Review boundaries

- Data safety: retain canonical content comparison and original record identities, guarded stale import refusal and pre-overwrite backup behavior. No import/export/synchronization code differs from the validated frozen input.
- Authority: stored-relation membership and design/role/cycle restrictions remain unchanged. Per-site builders/clients get no server-wide role. Trusted compiled-output publication is explicitly retained; an untrusted-code sandbox is not claimed.
- Compiler/browser: CLI and MCP archive hashes, exact dependency resolution and shipped files remain unchanged. CMS browser compiler, inline-edit specificity, top-layer dialogs, draft retention, repeater identity and warning/type fixes are preserved. Exact-package tests check the final integrated runtime.
- Framing compatibility: cross-origin embedding of RC.8 pages is intentionally blocked. Inventory external embeds and cross-origin marketplace/starter previews before upgrading a host; they require a separately approved and tested exception. The pilot covers new sites and same-origin previews and does not introduce an unrestricted allowlist feature.
- Release automation: no push to main/feature/rc branches, tags, releases, package/container/site publication or provider configuration occurs. Review rollout coupling before later authorization. Local/CI tests serve generated data over loopback only.
- Evidence: do not relabel historical RC.7 hosted/Safari/soak results as RC.8 coverage. Keep original archives immutable. Record final CI/native hashes and local package/recovery results outside the source commit, so evidence updates cannot silently replace product bytes.

## Approval still needed later

The final kit report must distinguish completed checks from missing real SMTP, physical phones, actual host/domain/CDN and representative legacy fixtures. Those gates follow the accepted pilot scope. The maintainer must review the consolidated diff and exact candidate identity before authorizing merge, publication or deployment; draft-skipped automated review is not approval.
