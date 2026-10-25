# Review and supersession map

[CMS #1363](https://github.com/primocms/primo/pull/1363) is the only CMS integration merge target. Review its cumulative diff against current main. Do not merge overlapping historical candidates first. Prefer a squash merge after separate authorization. No PR is merged by preparation. [RESULTS.json](RESULTS.json) records the 33 closed superseded targets and preserved heads.

| Component | Active target | Rule |
| --- | --- | --- |
| CMS | New consolidation PR, RC.13 | Cumulative RC.11 product/QA, current main, #1362 |
| MCP | primocms/mcp#30 | Already includes #29; no separate merge |
| CLI | primocms/primo-cli#67 | Already includes #64–66; no separate merges |
| Hosting | primocms/primo#1350 | Hosting-only against recorded baseline; never deploy its CMS tree |

INPUTS.json records every existing PR, immutable head/base and inclusion/defer decision. Historical CMS release/QA drafts #1323–1353 (excluding deferred mobile work #1341 and independent hosting #1350) are superseded as independent merge targets. Gaps in the PR numbers are not invented inputs. #1347 remains historical RC.9 hosted Safari evidence. #1362 is incorporated as a focused patch/regression with its source branch preserved. Historical PRs retain discussions and heads for focused review; mark supersession in their descriptions and never merge them independently. No issue closure or maintainer approval is inferred.

## Reconciliation decisions

- Keep main's transactional repeater/backend conflict protection. Adapt RC editor tests to its accessible menu while retaining identity/source-denial assertions. Retain both transactional reorder and field-entry move regressions under separate filenames.
- Register both recovery-upload middleware and content permissions.
- Keep main's generated-module SSR renderer alongside RC independent roots and lazy/recoverable worker client; do not restore the browser-incompatible static server renderer import.
- Retain failed drafts and queued reorder state in pending-change detection. Presence explicitly opts out of failed-write retention; the normal manager retains failed drafts, including new entries and reorder dependencies. Test the real manager and reorder module together.
- Restrict frozen RC.11 timing qualification to its historical base; new product tests use RC.13 artifacts. CLI #67 and MCP #30 now carry the authorized RC.3 dependency refresh; historical RC.2 source/archive heads remain provenance. Public-release/tag/container workflows are unchanged. codex/release-consolidation does not match main/feature/**/rc/** container push triggers.

Review data/permissions/conflicts/recovery first, compiler/publication second, bootstrap/hosting third, dependency/artifact/rollout evidence last. Reconfirm main and active heads against INPUTS.json before merge. Green checks are evidence, not maintainer approval.
