# RC.13 editor and feature reconciliation

Prepared October 25, 2026. Baseline: CMS 3167081fddfe291613a0e19bcc26682ba9044ed2. This is a new source revision of the unpublished RC.13 candidate. Earlier frozen builds and their passing evidence remain historical.

## Coverage

- Inspected 94 CMS/CLI/MCP/docs checkouts, including registered worktrees, old release/QA checkouts, local dirty working copies and the local plugin worktree. Every path has a disposition in worktree-inventory.json.
- Included all current feature PRs: CMS #1341/#1355/#1356/#1357/#1358/#1208; CLI #68/#69; MCP #31/#32; docs #9/#10. Hosting #1350 remains a separate hosting-only target; dependency-major bot PRs remain separate.
- Reconciled CDFI creation, template-copy lifetime, name/slug drafts, page reorder/rename/delete, link controls, section-content save, block-menu movement and image preservation fixes.
- Reconciled inline and rich-text stability, section-outline lifetime, dashboard navigation, group transitions and delayed Library loading.
- Included the 512 MiB bounded archive request budget on bootstrap/site/library import routes, preserving the 32 MiB multipart memory threshold and release authorization checks.
- Included older agent-launch worktree domain-publication preservation, readiness/capability discovery and site routing identity. Browser authorization uses the newer current PR implementation.
- Preserved upgraded SvelteKit APIs, pinned same-origin compiler runtime, atomic publication/script escaping, source/content permissions, transactional repeater ordering, failed-save retention and snapshot streaming.

## Worktree decisions

Original working copies are untouched. Historical, patch-equivalent and superseded prototypes are preserved; they are not outstanding feature inputs. The unfinished plugin/forms capability experiment is a WIP branch with no current PR and remains outside this release. New dependency-major automation is not a feature PR and remains outside the user-approved feature consolidation.

local-file-inventory.json and local-merge.json describe the CMS source comparison. companion-local-merge.json records identical, already-covered and newer-release conflict decisions for CLI/MCP/docs. The retained CLI conflicts are older implementations superseded by browser authentication and guarded synchronization; read_upload_paths in the release also preserves the newer portable-image preview fix. No uncommitted product fix from those companions is missing.

## Verification

Final results and source identity are recorded in the release PR and CI, rather than changing the source commit solely to record the hashes of that same commit. Test harnesses now use a real EventTarget for cancellable preview events and the current cache/reordering modules. Preview-head browser checks additionally cover page-cache suspension/resume. The browser-login handoff uses the installed candidate CLI by default. Mobile layout and local-development entry-point checks are included.

The client-site audit suite remains opt-in for private exported datasets; ordinary release workflows exercise isolated synthetic fixtures. No current QA or production server has been updated by this reconciliation.


## Original feature-review follow-ups

Seven still-valid minor findings from the original feature PRs are addressed in the cumulative candidates: responsive SiteEditor panes remount on orientation change; reduced-padding mobile titles clear the close control; esbuild is a direct devDependency; local publication processors/data helpers participate in the compiler fingerprint; each physical log line carries metadata; an exited/failed CMS stops startup waiting immediately with output listeners attached before PID recording; and the background example retains early startup stderr/stdout. Cache invalidation and multiline logs have regression tests, the immediate-exit test has a tighter deadline, and responsive split persistence is exercised across viewport changes.


## Final concurrent editor update

The final inventory comparison captured a scroll-restoration fix completed in the other editor chat during qualification. Library and both Marketplace views now preserve each Back/Forward history entry, including repeated visits to a group and delayed card loading. The dashboard-scroll helper, route snapshots and twelve rapid-navigation/history/refresh regressions are included. Refresh restoration additionally covers window scrolling in Sites and late authenticated dashboard mounts. The release uses SvelteKit 3 lifecycle-bound snapshots so each retained history entry and remounted dashboard has its own state. The regressions exercise delayed session validation, repeated group updates and authenticated dashboard remounts. The final source snapshot is recorded after the concurrent update.

The refresh regression additionally delays session validation to force the dashboard to remount during startup. Reload state survives those remounts and duplicate action updates, then releases on navigation so each history entry keeps its own position.

Loading placeholders now expose the skeleton marker used by the scroll helper, preventing restoration from completing against placeholder heights before real cards arrive.

RC.13’s guarded cache loads exposed a separate slow-Library retry loop during delayed session validation: repeated relationship reads constructed independent mapping owners, allowing a canceled older load to evict its replacement. Scoped mappings now share ownership per manager. The deterministic regression fails against the prior implementation and passes with the fix; a second regression verifies separate servers keep independent records. All 153 integration tests and all 19 dashboard regressions pass locally on the final combined code.

The responsive split-persistence regression uses the pane’s accessible keyboard resize control to avoid a stale pixel drag target during dialog opening. All original size/restoration assertions remain. The focused regression passes twice each in local Chromium and Firefox; current supported WebKit is qualified in CI because macOS 14’s frozen local WebKit cannot create a page with the locked Playwright protocol.

The refresh harness waits for the authentication response and the resulting view update before asserting final content/scroll state. A trace showed the previous one-pixel wheel animation moved the page from its assigned 120 to 281 before pagehide; the app correctly persisted/restored 281. Fixture positioning now follows trusted non-moving keyboard input. All original exact-position, selected-group, content and layout assertions remain, with no timeout or retry relaxation. The final harness passes all 19 dashboard checks and five consecutive Firefox repeated-refresh cases locally.

Infrastructure qualification budgets now include dependency installation plus the expanded suites: main E2E 35 minutes and exact-browser 40 minutes. A prior exact Firefox job passed all 86 workflows but exhausted its 25-minute job budget after a long browser install, before handoff checks. Per-test timeouts, performance bounds, assertions and retry counts are unchanged. Main E2E pins Ubuntu 24.04 to match the qualified browser/native environment rather than inheriting the ongoing ubuntu-latest image migration. Browser compatibility also reruns when either qualification workflow changes.

The last input comparison also captured the subsequent completed Sites/Library editor-return fix: toolbar/close controls and repeated Back/Forward navigation preserve the selected group and scroll. Library block editors get a history entry and closing returns to the list entry. Four added regressions cover both editors and return methods. The SvelteKit 3 navigation options are retained, and this completed input set is frozen for RC.13 qualification.

Editor-return integration uses registered SvelteKit 3 snapshots for per-history-entry state. A late preview relayout can clamp a correctly restored container; restoration now retains its target until real user input and reapplies it on non-user scroll events. A dedicated regression collapses/re-expands the preview list after history restoration and verifies the exact original position. All 24 dashboard checks pass locally, including the four editor-return cases. No position, content or performance bound was relaxed.
