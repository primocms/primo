# Stable preparation — publication held

This branch prepares the stable CMS 3.3.2 version tuple and consumes the exact
unpublished MCP 0.1.11 / CLI 0.3.0 archives in final-packages/. Product onboarding,
native build identity and active qualification expectations use those stable
versions. The candidate source/evidence remains preserved on the parent release
branch. Native CI must build these source bytes; no RC binary is relabeled.

Local checks: source check zero errors/warnings and all 159 integration tests
pass. The freshly built stable Mac executable is exercised with the exact
stable archives. Full current-head native/browser/recovery/security CI is the
next gate. Stable tarball hashes and offline handoff evidence are retained in
final-packages/ and the parent qualification record.

Still held: registry publication/integrity handoff, main merges, tags,
containers/releases and production deployment. Hosted QA remains unresolved
following the pinned hour's TCP timeouts and requires verified recovery and a
passing run covering the final product changes. Do not overwrite active QA
writers or promote failed/earlier evidence to this new identity.

The local stable fresh-machine gate now also passes: private Node installation,
exact npm archives, actual MCP connectivity, scoped pull, managed and tagged
CMS installation, port recovery, file/visual mode switching, preview/build and
shutdown. All 29 release-preparation tool regressions pass. RC-only escaped
version assertions were updated to the stable identity; their behavior checks
and timeouts remain enforced.
