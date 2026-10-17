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

## Review boundaries

- Data safety: retain canonical content comparison and original record identities, guarded stale import refusal and pre-overwrite backup behavior. No import/export/synchronization code differs from the validated frozen input.
- Authority: stored-relation membership and design/role/cycle restrictions remain unchanged. Per-site builders/clients get no server-wide role. Trusted compiled-output publication is explicitly retained; an untrusted-code sandbox is not claimed.
- Compiler/browser: CLI and MCP archive hashes, exact dependency resolution and shipped files remain unchanged. CMS browser compiler, inline-edit specificity, top-layer dialogs, draft retention, repeater identity and warning/type fixes are preserved. Exact-package tests check the final integrated runtime.
- Framing compatibility: cross-origin embedding of RC.8 pages is intentionally blocked. Inventory external embeds and cross-origin marketplace/starter previews before upgrading a host; they require a separately approved and tested exception. The pilot covers new sites and same-origin previews and does not introduce an unrestricted allowlist feature.
- Release automation: no push to main/feature/rc branches, tags, releases, package/container/site publication or provider configuration occurs. Review rollout coupling before later authorization. Local/CI tests serve generated data over loopback only.
- Evidence: do not relabel historical RC.7 hosted/Safari/soak results as RC.8 coverage. Keep original archives immutable. Record final CI/native hashes and local package/recovery results outside the source commit, so evidence updates cannot silently replace product bytes.

## Approval still needed later

The final kit report must distinguish completed checks from missing real SMTP, physical phones, actual host/domain/CDN and representative legacy fixtures. Those gates follow the accepted pilot scope. The maintainer must review the consolidated diff and exact candidate identity before authorizing merge, publication or deployment; draft-skipped automated review is not approval.
