# Stable preparation — publication held

For the current review fixes, compatibility notes, and exact-commit release
procedure, see [RELEASE_3.3.2.md](RELEASE_3.3.2.md). The qualification
records below are historical and do not qualify those fixes.

This branch prepares the stable CMS 3.3.2 version tuple and consumes the exact
unpublished MCP 0.1.11 / CLI 0.3.0 archives in final-packages/. Product onboarding,
native build identity and active qualification expectations use those stable
versions. The candidate source/evidence remains preserved on the parent release
branch. Native CI must build these source bytes; no RC binary is relabeled.

Qualification at `85867022c9b2744bdbab5393947afdf87d8c373f` passed all
20 stable checks, including five native platforms, source/installed browser
engines, native Safari, fresh installation, production validation, recovery,
framing and security. Recorded runs:
- Native/downstream: https://github.com/primocms/primo/actions/runs/40998678023
- Source: https://github.com/primocms/primo/actions/runs/40998678113
- E2E: https://github.com/primocms/primo/actions/runs/40998678302

The final ten-editor hosted hour passed on the prerelease source `10d6d648`
(run 40999083456): 3600.002 seconds, 17000 requests and zero errors. This was
not a hosted run of the stable executable. Earlier TCP timeout evidence remains
historical; the passing CI hour does not claim its local trigger was fixed.

New review fixes change source/package identities. Those changes need fresh
qualification; the completed runs above attest only their recorded source.
Stable tarball hashes and offline handoff evidence remain in final-packages/.
Registry publication/integrity handoff, integration merges, tags, containers,
release publication and production deployment remain held.

The previously recorded local stable fresh-machine gate is historical. It used
earlier package/source identities and does not qualify the current archives.
Current exact-package local results and hashes are recorded in
`final-packages/qualification-local.json`; the final-head cross-platform
fresh-machine, native and browser qualification gate remains pending until its
new CI run completes. Published-registry installation remains a separate held
gate. RC-only version assertions use the stable identity; behavior checks and
timeouts remain enforced.
