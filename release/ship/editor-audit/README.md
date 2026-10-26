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
