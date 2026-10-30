# Founding-builder release — consolidated RC.13

This is the single CMS integration target for the supervised ten-builder, new-site desktop pilot. It reconciles current main with cumulative RC.11 product/QA and #1362 script escaping. CMS is 3.3.2-rc.12; audited package candidates are CLI 0.3.0-rc.3 (#67) and MCP 0.1.11-rc.3 (#30). Hosting #1350 remains hosting-only.

Read the current [scope](release/ship/SCOPE.md), [inputs and PR decisions](release/ship/INPUTS.json), [review map](release/ship/CONSOLIDATION.md), [validation](release/ship/VALIDATION.md) and [shipping checklist](release/ship/ROLLOUT.md). Earlier release documents and candidate results remain historical. Do not merge overlapping historical chains independently.

RC.13 has new bytes and requires fresh exact-package qualification. Proposed stable versions: CMS 3.3.2 / CLI 0.3.0 / MCP 0.1.11. Final packaging and registry locks remain deferred.

No merge, tag, publication, deployment, mail or invitation is part of this work. Main pushes and published v3 releases can update containers/consumers, including prereleases. Preparation uses codex/** and draft PRs only. Validation and scoped hosted/client gates must pass before a release decision.

Security refresh: Go 1.26.10 and SvelteKit 3.1/Svelte 5.57.2; CLI/MCP locks are refreshed and source builds now require Node 22.17+ or 24. Strict npm and reachable-Go gates remain enforced. See release/ship/VALIDATION.md for final-head evidence.
