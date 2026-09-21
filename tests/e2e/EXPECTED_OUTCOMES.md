# Expected-outcome matrix — first-pass regression suite

Written before implementation, per task requirements. "Pass" = asserts exact
persisted values / served output, not toasts. Server under test runs against
an isolated `pb_data` dir on a non-default port with `PRIMO_DEV_MODE=1`, so
`/api/primo/dev-auth` is available for fast, deterministic auth setup.

| # | Area | Action | Expected outcome | How verified |
|---|------|--------|-------------------|---------------|
| 1a | Content persistence | Edit headline (text), rich text, and image on a page via editor UI | Exact new values present after `location.reload()` | Read field value from DOM / PocketBase record after reload |
| 1b | Content persistence | Same, but reopen in a brand-new browser context (fresh storage state, re-auth) | Same exact values as 1a | New `browser.newContext()`, re-login, read values |
| 2a | Repeaters | Create 3 items with distinct names A, B, C | 3 entries exist, each with correct name, correct `index` 0/1/2 | Query `page_section_entries` (or read DOM) grouped by `parent` |
| 2b | Repeaters | Edit middle item (B) | Only B's value changes; A and C untouched | Compare before/after per-item values by stable id |
| 2c | Repeaters | Reorder (e.g. move C before A) | Item identity (name+content) follows the item, not the slot; only `index` values change | Assert each item's content by its parent id, not by position |
| 2d | Repeaters | Delete one item (e.g. A) | Exactly 2 items remain (B, C), correct content, no duplicate, nothing resurrected | Count + content check |
| 2e | Repeaters | Edit again after delete+reorder, then reload | Final state exactly matches expected mapping of {remaining items → content} | Reload, re-read, compare set |
| 3a | Publishing | Publish fixture site (`POST /api/primo/generate`) | Served HTML at published host contains the edited content from step 1 | `fetch`/`page.goto` published URL, assert exact text in HTML |
| 3b | Publishing | Make another edit, republish | Served HTML updates to the new value (old value gone) | Same as above, before/after diff |
| 4a | Permissions (documented) | Editor performs an allowed content edit (edit text field, per docs: "editors work within guardrails you define") | Edit succeeds, persists | Same persistence check as 1a using editor session |
| 4b | Permissions (documented UI) | Editor opens the Pages modal, which hosts page-type management — the "Manage page types" button is gated by `serverRole/siteRole === 'developer'` (supplied by `Toolbar.svelte` into `SitePages.svelte`) | Control is hidden/inaccessible in UI for editor | UI assertion (locator not visible / not present) |
| 4c | Permissions (server-side, exploratory — see ambiguity note) | Editor sends a direct API request to delete/modify a `page_types` (or `site_symbols`) record for the site | **Expected per docs: denied. Expected per code (found in recon): ALLOWED** — PocketBase collection rules key only on `site_role_assignments` presence, not `role` value | Direct authenticated `fetch` to PocketBase REST API with editor's token; record actual HTTP status, do not assume |
| 5a | CLI round trip | Establish author-mode: server started with `PRIMO_AUTHOR_MODE` unset/`both` for this test (`primo dev` not used — direct `push`/`pull` against a running server is CMS-mode-agnostic; author-mode gating is a `primo dev` local-sync-only concept per recon) | `pull` succeeds, produces local files with current CMS content (incl. step-1 edits) | Inspect pulled YAML for edited values |
| 5b | CLI round trip | With CMS content edited (via UI) AFTER pull but BEFORE push, and local component styling edited, then `push` | **Record actual behavior — do not assert a specific "safe" outcome without evidence.** Candidate outcomes: (i) push overwrites CMS-side content edit with stale pulled value (data loss), (ii) push only touches structure/style and leaves content alone, (iii) push fails/conflicts | Compare CMS content value before push vs. after push; report exactly what happened, classify as bug/ambiguous/expected |

## Known ambiguities to record, not resolve by assertion

- **Editor vs. developer server-side enforcement**: recon (two independent
  passes) found no PocketBase API rule anywhere that branches on the `role`
  field value (`editor` vs `developer`) — only on whether a
  `site_role_assignments` row exists at all. The only role-value check is a
  billing seat-counter (`internal/limits.go`) and a few UI `{#if}` gates in
  `Toolbar.svelte`. Test 4c is written to capture actual behavior as
  evidence, not to enforce a hoped-for contract.
- **CLI push/pull content-loss**: `primo-cli/BUGS.md` documents an
  unresolved, acknowledged bug in `--author cms` sync (separate from the
  push/pull path this suite exercises). Test 5b targets the push/pull path
  specifically since that's what the task asks for; the `primo dev` live-sync
  bug is out of scope but noted.
- Repeater export/reorder bugs are documented in `primocms/BUGS.md` under
  "Repeater issues still needing follow-up" — tests 2c/2d exercise exactly
  this surface and may reproduce them; any failure there is a reproduced
  product bug, not a test bug.

## Explicitly out of scope this pass

Analytics, billing/seat limits, marketing pages, domain/DNS flows, broad
browser/device matrix, `--author cms`/`both` live-sync correctness (primo-cli
`dev` command), primo-mcp (dev-tool for block authors, not part of the
developer→editor handoff flow under test).
