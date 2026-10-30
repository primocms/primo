# RC.13 security and qualification record

The current integration target is [CMS #1363](https://github.com/primocms/primo/pull/1363). This security refresh supersedes the RC.12 audit failures; older source/artifacts and their failures remain historical evidence. No publication, deployment or invitation is part of this work.

## Remediation

- CMS: SvelteKit 3.1.0, adapter-static 4, Vite 8, TypeScript 6, runed 0.38 and matching Svelte 5.57.2. Configuration is discovered through vite.config.js/app.config.js; existing library imports remain a conventional Vite alias. Source builds require Node 22.17+ or 24; CLI runtime minima remain 22.13 and 24.0.
- Updated environment, navigation, readonly-URL and client-error hook APIs. Unknown client errors retain the safe framework message and never wait for telemetry.
- The upgraded runtime exposed esm.sh disk-space failures and timeouts. Core Svelte plus clsx/devalue sources/licenses are packaged from the exact lock as hashed same-origin assets. The real loader still bounds, retries and evicts failed downloads. CDN-blocked browser publication verifies SSR, client hydration and interactive output; timeout/retry tests target actual packaged module requests without weakening assertions or increasing timeouts. Other authored dependencies retain the existing resolver.
- Go 1.26.10 fixes GO-2026-6809. Build/native/release/Docker paths use the patched toolchain; the scanner itself is built with patched Go 1.27.3. Product builds retain the 1.26 line because the earlier 1.27 PocketBase regression remains outside this change.
- CLI 0.3.0-rc.3 and MCP 0.1.11-rc.3 refresh their vulnerable locks and raise the Markdown parser floor to 14.3.3. CLI source lock resolves the retained exact MCP archive; shipped metadata retains its exact candidate version. New local archives and SHA-256 values are in tests/staging/rc8-packages.json.
- Hosting uses Go 1.26.10 and x/crypto 0.57 with compatible transitive updates. It remains a separate hosting-only review target; never deploy its older CMS tree.

- Final handoff exposed stale imported group caches masking nested repeater edits on pull. Export now prioritizes structured child records, retains stored-only legacy groups and unmodeled legacy keys, and does not restore deleted modeled values. A regression fails on the previous source and passes with the fix. Native Safari now exercises the current owned move menu; recovery checks the current RC.13 version.

## Onboarding qualification dependency refresh

The October 27 advisory update changed the previous qualification's audit results. The strict gates found reachable GO-2026-6860 in x/net's HTML parser and GHSA-gcqx-w48m-w2h4 in the Svelte build plugin's merge dependency. CMS now uses x/net 0.62.0 and its required compatible transitive updates. There is no published patched deepmerge version; a private, explicitly renamed local fork applies the documented forbidden-key/data-property repair, retaining the original MIT license. A root npm override replaces the vulnerable implementation for all callers. Reproducer tests fail against upstream 4.3.1, then pass with the patch alongside nested-option/array/symbol/custom-merge compatibility checks. `release/vendor/deepmerge/README.md` records provenance, scope and removal criteria; INPUTS.json pins its implementation hash. No advisory exclusion or severity relaxation is added.

## Security gates

Full npm audits for CMS, CLI and MCP report **zero vulnerabilities**, with no exclusions or lowered severity threshold. CMS and hosting govulncheck report **zero reachable and zero imported-package vulnerabilities**. The scanner additionally reports GO-2026-5932 for unmaintained OpenPGP code contained in x/crypto: this package is not imported or called, has no fixed module version, and remains module-only evidence. It is not suppressed; patched crypto versions are retained for the packages actually used.

## Local evidence

- Source/type/Svelte check: zero errors/warnings. All 140 integration tests, 27 compiler/component browser cases, 29 staging-tool regressions and full CMS Go tests pass.
- CLI: all 187 tests pass with zero skips on Node 22.13.0 and 24.0.0, including real CMS push/publish/upload contracts, browser hydration and Node 20.19 rejection.
- MCP: all 19 runtime/compiler/image/link/cache/hydration/resolution regressions pass on both minimum runtimes. Build and full protocol smoke suite against a disposable synthetic site pass.
- Hosting: full race-enabled suite and reachable vulnerability scan pass.
- Three focused real-browser core-runtime cases pass: idle worker lifecycle, shared download failure/retry, and successful browser publication/hydration with the CDN blocked. Broader final-source and exact-package workflows are recorded in the PR after completion.

The initial post-migration CDN-dependent local runs were stopped after concrete provider failures/timeouts; they are not counted as passes. The current source fixes that dependency and must pass the full current workflows. Source-build checks and exact immutable native-package qualification are separate. Final PR-head CI run links and results are recorded on #1363 rather than creating a new source commit that changes tested VCS identity merely to record results.

## Shipping boundaries

Final-head five-platform/native, three-engine source and exact-package workflows, Safari, framing and copied recovery must pass before code-readiness is claimed. MCP-first registry publication and stable lock/integrity refresh, final registry handoff, RC.13 hosted purchaser/ingress/realtime/mail qualification, selected host/support/recipients and first-client device/domain/operations or actual legacy migrations retain their scoped external gates. They cannot be claimed complete under the no-publication/no-deployment instruction.

## October 27 batched import follow-up

This revision addresses #1354 with CMS staging and the CLI archive identified
by `INPUTS.json.batchedImports` and `tests/staging/rc8-packages.json`.

- CLI source build and all 211 tests pass, zero skips, on Node 22.13.0 and 24.0.0.
- Full CMS `go test ./...` passes on Go 1.26.10; focused chunked-import and
  bounded-library tests also pass with the race detector.
- The exact rebuilt CLI archive, installed from the CMS lockfile, passes the
  real-CMS 36 MiB round-trip through a 256 KiB proxy. Coverage includes lost
  chunk acknowledgements, both library commands, preview without mutation,
  stable upload IDs, rejected stale final commits and removed staging files.
- The same installed-package contract is now part of `tests/platform`, so
  existing native-platform CI runs it against each candidate executable.

The local CMS executable reused the previous candidate's generated frontend
and common validation assets; this backend-only check does not replace a fresh
full-source native build. The new head's existing native/browser qualification
workflows must complete before release readiness or publication is claimed.
No registry publication or deployment has been performed.

## October 28 site-field integration and held final packages

Owning-site keys and field IDs now resolve consistently in browser publishing,
MCP publication, static builds and partial imports. Missing/ambiguous references
fail before publication artifacts are uploaded. IDs retain precedence over keys.

Local current-source evidence: CMS source check has zero errors/warnings; all
159 integration tests and full Go suite pass. CLI has 214 passing tests with
zero skips on Node 22.13.0 and 24.0.0. MCP has 36 passing publishing/runtime
regressions on both minimum runtime lines, plus Svelte resolution, null-image
and protocol smoke checks. Fresh CMS frontend assets were built for this run.

The rebuilt exact candidate MCP/CLI archives are in release/vendor with updated
locks/manifests. The real site-field publication/round-trip/live-preservation
contract is now part of the five-platform installed-package gate.

Prepared stable MCP 0.1.11 / CLI 0.3.0 tarballs and integrity manifest live in
final-packages/. Both exact tarballs passed a disposable offline installation
and real-CMS site-field/proxy contracts. They remain unpublished. Final CMS
native bytes, full current-head CI, hosted one-hour QA and actual registry
handoff are still gates; no older run is promoted to cover these changed bytes.
