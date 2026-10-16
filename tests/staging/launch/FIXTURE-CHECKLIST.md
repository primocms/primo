# Sanitized fixtures and restore checklist

Nothing in this folder extracts a backup, migrates data, creates accounts or publishes a fixture. These are preparation instructions for the fixture owner and later authorized disposable-environment checks.

## Representative legacy backup (highest priority)

- [ ] Prefer a native PocketBase backup ZIP. Alternatively supply a consistent **offline** data directory containing `data.db` and its uploads. Do not copy a live SQLite file while writes are occurring; a directory containing `-wal` or `-shm` is rejected by the inventory helper. A native backup is accepted as a file without extraction, so its internal consistency still needs owner verification and disposable restore testing.
- [ ] Include associated storage objects for uploads held outside the data directory, mapped by IDs/path. Do not supply credentials to a production bucket; supply sanitized copies instead.
- [ ] Record exact source Primo and PocketBase versions (or explicitly document an unknown version and why), upgrade history, any custom migrations and required settings. Preserve a separate untouched copy for before/after comparison.
- [ ] Sanitize **a copy**: remove real customer content/PII, tokens, auth sessions, API keys, mail credentials, payment/billing, analytics and live provider integrations. Replace accounts with controlled test identities. Preserve identifiers, relationships and representative data shape needed to reproduce migration problems. Review uploaded files and metadata too.
- [ ] Supply cases with nested page-type fields, groups, nested repeaters including empty lists, ordered siblings, moved items, reused blocks, drafts differing from published pages, more than one page type, media references and at least two roles. Include older sync fixtures for #1239/#1241 and the historical #705/#1235 cases if available.
- [ ] Provide expected sites/pages/uploads counts, key record IDs, field/entry ancestry, repeater order and values, role mappings, URLs and reference screenshots/exports. Hashing does not verify these expectations against a database.
- [ ] Independently compute the owner SHA-256 and put it in `fixture.local.json`. For a ZIP: `shasum -a 256 /path/to/sanitized-backup.zip`. The file bytes are the checksum input, not the extracted directory.
- [ ] Set both owner attestation flags only after sanitation and consistency review. Keep the backup and inventory reports private. File names can contain sensitive information.

For directory snapshots, the checksum algorithm is SHA-256 of a manifest: sort relative file paths by UTF-8 byte order, then concatenate `relativePath + NUL + lowercaseFileSHA256 + LF` for each file. Paths use `/`; empty directories are not hashed. Prefer the native ZIP workflow when an independent directory manifest is unavailable. Symlinks and nonregular files are rejected; files/directories changing during inventory fail. Bounds: 100,000 files, 10 GiB per file. Do not place the evidence output inside the backup.

## Synthetic staging fixture

Use ten independent sites named **`PRIMO QA agency-01`** through **`PRIMO QA agency-10`**, with one distinct site-scoped **editor** account per site. Users must have blank `serverRole`, exactly one visible site, and exactly one own editor assignment. Do not use a superuser or developer for the soak. Keep a separate developer account and separate client inbox for the manual handoff.

The supplied source fixtures map to the existing Primo file layout:

| Supplied file | Location in a synthetic CLI site |
| --- | --- |
| `fixtures/qa-block.svelte` | `blocks/qa-probe/component.svelte` |
| `fixtures/qa-fields.yaml` | `blocks/qa-probe/fields.yaml` |
| `fixtures/qa-content.example.yaml` | `blocks/qa-probe/content.yaml` (required defaults) |
| A block config `name: QA probe` | `blocks/qa-probe/config.yaml` |
| A page-type config `name: Default` and `allowed_blocks: [qa-probe]` | `page-types/default/config.yaml` |
| `fixtures/qa-page.example.yaml` | `pages/index.yaml` |

Replace every environment marker with the one unique disposable environment ID. For each site's page, replace the scratch baseline with **`QA scratch agency-NN`**. The page has five block instances with visible headings `QA section 0` through `QA section 4`, a nested list, and a click counter in each block. The `qa_scratch` field is intentionally **not rendered**. Keep the environment marker unchanged during manual edits. The packaged MCP validator emits two intentional advisory warnings: the attribute-only environment marker has no inline `data-key`, and `qa_scratch` is unused by the rendered component. All fixture validation errors must be zero; visible heading/list text has explicit inline-edit keys. The already-published page must expose five `data-primo-launch-fixture` markers with that environment ID. Do not use a hidden admin/private page for the anonymous marker probe.

Map each actor to its first block instance's root `qa_scratch` text entry. Supply the user/site/page/section/field/entry IDs in `staging.local.json`; all are PocketBase 15-character IDs. Record field key `qa_scratch`, root ancestry (empty parent), locale/index and baseline. Different actors require different users, sites and entries. The runner verifies the ownership chain and bindings before writing; it changes only `{value: ...}`.

The fixtures are source templates. **Do not publish or push them to an external environment under the current task.** Supply an existing marked fixture, or leave the corresponding gates blocked until fixture population is separately authorized. Local disposable creation can be used in a later rehearsal with the frozen CLI/MCP archives and exact CMS binary; no registry credentials are necessary.

## Later disposable restore acceptance

- [ ] Record backup checksum, original versions, target RC.7 binary hash, target resources and start/end times.
- [ ] Restore into a fresh private copy; disconnect real integrations before starting. Keep production-mode validation enabled. Preserve an independent original and a separate post-upgrade backup.
- [ ] Compare all supplied counts, IDs, ancestry, nested values/order and uploads; load representative draft and published pages. Verify owner and client permissions.
- [ ] Edit/save/reload nested repeaters, including reorder; pull twice and compare stable IDs; exercise non-destructive push conflicts on copies; compare files and database state after each step.
- [ ] Restore the post-upgrade backup into another empty disposable environment with the matching candidate and verify the same expected state.
- [ ] For rollback, use an untouched pre-upgrade backup with its original compatible server. Never point an older server at a database already upgraded by RC.7.
- [ ] External publish/republish and real invitation delivery remain NOT_RUN under the current restriction. Record them independently; migration success alone does not clear handoff.
