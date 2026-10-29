# Shipping checklist — execution deferred

No live actions below are executed or authorized by consolidation.

## RC.13 prerelease path

The stable-version checklist below is a later promotion path, not a requirement
to rename RC.13 as stable. The coordinated prerelease tuple remains CMS
3.3.2-rc.13, CLI 0.3.0-rc.3 and MCP 0.1.11-rc.3.

1. Freeze the final source. Require passing native/exact-package, browser,
   source, staging and release-safeguard checks at that source. The October 28
   hosted profile passes for fed368b4; later product changes need new evidence.
2. Verify the exact candidate archives against rc8-packages.json. Publish MCP
   first to npm's `rc` dist-tag, never `latest`. Refresh source registry locks
   to the same immutable archive integrity and verify dependency resolution.
3. Create the CMS tag at the qualified source. The candidate release workflow
   copies the five tested CI executables after checking source, version,
   platform and SHA-256; it refuses to rebuild replacement RC bytes. Review the
   draft as a prerelease, with checksums/provenance and the coordinated notes.
4. Make the compatible CMS prerelease available, then publish the exact CLI
   archive to npm's `rc` dist-tag. The released image gets only the exact RC
   version tag. Stable minor/major/latest tags must remain unchanged.
   The RC image copies the same qualified Linux executables from the release
   and verifies their provenance/checksums; it does not compile new RC binaries.
5. From empty profiles, install from the public registry and exact GitHub tag;
   verify every shipped file, Node 22/24 CLI and MCP startup, browser consent,
   scoped pull, local development/preview and visual-edit writeback. Archive
   the results and confirm the public tuple matches Develop locally.

Steps that publish immutable artifacts require release authorization and npm
publishing access. A local/offline rehearsal cannot clear the final public
registry handoff. Stable promotion, real recipient mail, pilot activation,
first-client physical devices/domains and legacy migrations keep their own
scoped gates; they do not block publishing a clearly labeled desktop/new-site
prerelease. Earlier intermittent hosted stalls remain recorded and unresolved;
passing a bounded profile is not a broader availability claim.

## Stable promotion and rollout

1. Review the four active targets and resolve VALIDATION.md findings. Require green source, integration, Go, native and exact-package checks at the final CMS head. Recheck current advisories for CMS/CLI/MCP/hosting. Confirm the proposed stable versions in SCOPE.md.
2. Control publication automation before main merge: main/feature/**/rc/** pushes publish containers; v* tags build draft binary releases; published v3 releases, including prereleases, publish latest and can update consumers. Inventory/pin actual consumers. Preparation uses codex/** and a draft PR only.
3. After publication authorization, publish MCP first. Refresh CLI/CMS test dependencies to its exact registry version/integrity, remove temporary vendor references and package final versions. Every changed source/version/lock/reference/byte identity needs a new manifest and qualification.
4. Verify fresh disposable installations: every shipped file; CLI/compiler regressions on Node 22.13 and 24; five native production gates; three-engine exact Linux handoffs; native Safari/Node 24 handoff; framing and copied-backup recovery. Preserve failures and original artifacts. Never relabel old candidate bytes as stable.
5. After staging/deployment authorization, verify final CMS plus approved hosting through real provider/DNS/TLS/ingress, secret removal/restart readiness, purchaser login/reload and realtime. Verify actual invitation/setup/reset delivery with authorized recipients and running hashes/digests. RC.10 evidence does not clear RC.13.
6. Record host/support/backup owners and private builder assignments. Restore a consistent private backup into an empty target. Confirm limiter, production validation, dev-auth denial, site scope and framing compatibility. Follow ../rc8/RECOVERY.md: restore a separate copy with matching older bytes; never downgrade upgraded data.
7. Make compatible CMS available before public CLI; publish CLI last after separate authorization. Verify a fresh registry handoff. Onboard one builder then nine, with recipient-specific invitation authorization. Begin with drafts.
8. Clear first-client phone/domain/TLS/CDN/handoff/operations checks before publication and representative legacy fixtures before migrations. Stop for data loss, cross-site access, destructive stale conflicts, failed recovery, unusable backup or a failed publish replacing prior live output.
