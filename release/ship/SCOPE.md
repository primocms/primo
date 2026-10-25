# Founding-builder release scope

Prepared 2026-10-25. This is the current release contract; release/rc8 documents remain historical. No merge, tag, publication, deployment, live mail or invitation is part of preparation.

## Audience and versions

Supervised ten-builder pilot for new sites and desktop editing, with operator-provisioned site-scoped developer and content-editor roles. Proposed stable versions: CMS 3.3.2, CLI 0.3.0, MCP 0.1.11. Candidate versions: CMS 3.3.2-rc.12, CLI 0.3.0-rc.2, MCP 0.1.11-rc.2. Final version changes require new artifacts and verification.

## Included

- Cumulative RC.11 CMS product and latest QA: guarded synchronization, nested field/content identities, content-only source permissions, production validation, independent hydration/head identity, cache/security headers, supported runtimes, same-origin framing, compiler lifecycle/recovery, presence/reload/save recovery, managed purchaser bootstrap and owner-only access.
- Current main at INPUTS.json's SHA, retaining transactional repeater ordering/ancestor values (#1359), browser publication/snapshot preservation (#1360), authenticated streaming recovery snapshot uploads (#1361).
- The reproduced inline hydration-prop script escaping fix and regression (#1362).
- Existing CLI #67 and MCP #30 candidates and unchanged RC.2 archives. Registry preparation remains a later gate.
- Hosting readiness/security #1350, independently reviewed as hosting-only; its older CMS tree is never a CMS release source.
- Compatible CMS dependency-lock security refreshes; no forced framework major upgrades. Current findings belong in VALIDATION.md.

## Deferred

Browser-approved login (CMS #1357, CLI #69, docs #10); agent logs (CLI #68, MCP #31, docs #9); incremental publishing (CMS #1358, MCP #32); preview head inheritance (#1356); sidebar/page-list polish (#1355); mobile editing (#1341); dashboard local-development affordance (#1208); unrelated dependency majors/new features. A newly reproduced security/data-loss blocker requires a scope amendment and requalification.

General cross-origin embedding, hostile-publisher sandboxing, delegated invitations, legacy migration promises, production SLA and broader-scale claims remain outside this pilot. Editors remain trusted publishers of compiled output.

## Identity and gates

RC.12 is a new product identity because main and #1362 change RC.11 bytes. RC.11 results are historical baseline evidence. Native CI builds and verifies RC.12 from the exact PR head. CLI/MCP hashes remain in tests/staging/rc8-packages.json; the rc8 path is compatibility naming, not the CMS version.

Accepted one-hour ten-editor API/content limits: p95 public <=1 s, save/readback <=2 s, zero errors; this does not attest ten simultaneous browser compilations. Zero data loss, cross-site access and destructive conflict overwrites are required.

Pilot activation needs the final candidate's hosted purchaser/ingress/realtime checks, actual invitation/setup/reset delivery on the selected host, host/support ownership and private recipient-to-site assignments. RC.10 provider/mail and RC.9 pilot evidence are historical. Physical iPhone/Android public-page checks, actual domain/TLS/CDN when used, backup/restore and client handoff gate first-client publication. Representative sanitized fixtures gate actual legacy migrations. Desktop new-site drafts do not imply client-publication authorization.
