# Safe CLI pushes

Normal `primo push` refuses to overwrite server data changed since the last
successful pull or push. The CLI preflights all included sites and the shared
library before uploading anything. Each import checks its revision again in
the transaction that applies the changes, including site name/group writes.

An intentional overwrite uses `primo push --force`, lists the targets, and asks
for confirmation. Scripts must explicitly pass `--force --yes`. Force sends
the revision observed during preflight; it does not bypass the comparison. A
new edit after confirmation still rejects the import.

## Protocol

- `GET /api/primo/push-state/{siteId}` and `/push-state/library` return
  `{ protocol: 1, exists: boolean, revision: string }`. A missing site returns
  `exists: false, revision: "absent"`; an unavailable endpoint is not absence.
- Site/library export responses include `X-Primo-Revision`, captured in the
  same transaction as the exported data. Do not obtain the baseline from a
  subsequent state request, which could include edits absent from the export.
- Import multipart requests include `expected_revision`. Missing preconditions
  return 428; changed revisions return 409, before any writes. Success returns
  `revision`, computed in the import transaction, and optionally `backup`.
- `force=true` requires a matching revision and a successful server backup
  before replacing existing data. It is not permission to overwrite later edits.
- Bootstrap returns the committed revision too. Its empty-server check and
  writes now share a transaction. Unauthenticated first-time library creation
  can proceed only while the library and server are empty.
- Local file-watcher requests in `PRIMO_DEV_MODE=1` retain their author-mode
  policy. Explicit requests carrying `expected_revision` are always checked.

Revisions hash sorted records for content, fields, blocks, page types, layouts,
pages, sections, their ordering, uploads, site metadata, and the site's group.
Record IDs include additions/deletions. Timestamp-only updates, compiled page
and symbol output (including compiler hashes), thumbnails, domain state, presence, analytics, and publish snapshots
do not cause conflicts. The scope must be updated when the importer gains a
new writable collection. All write paths are covered by reading stored state;
there is no counter whose update can be missed by an API or background job.

## Backups and recovery

Forced overwrites save private ZIP exports in
`<data-dir>/push_backups/<siteId-or-library>/backup-*.zip`. Creation failures
abort the import. The download route
`/api/primo/push-backups/{target}/{backup}` checks authentication and target
access; these are not public PocketBase file URLs. The CLI prints that URL and
downloads a copy into the target's `.primo/backups/` directory. There is no
automatic pruning. A failed import can leave a retained pre-import backup.

Extract a backup into a separate directory, inspect it, set the target server
in `site.yaml`, and use `primo push --dir <directory> --force` to recover its
content. For a library, use `primo library push <server> --dir <directory>
--force`. Recovery makes another backup before replacing server data. This
does not automatically republish the website.

The ZIP also contains `.primo/backup-records.json`: the original scoped records,
revision, and target. Preserve this for operator-assisted recovery of properties
the portable import format cannot yet round-trip (such as unsupported nested
page-type fields and group metadata). The normal import does not consume this
raw record file, and ZIP recovery is not a full-instance database restore.

## Whole-server behavior

Existing conflicts block every upload, including the library. Imports are
atomic per target, not for the whole server. A client edit during a later
upload can therefore leave earlier targets successfully saved. The CLI stops
and reports completed, failed, and unattempted targets, preserving each
successful target's new baseline. A lost response may need verification; a
subsequent ordinary push cannot silently bless the unknown server state.

Pull overwrites local files; it is not a merge. Save local work before pulling
after a conflict. Missing baselines on existing targets fail closed, including
workspaces pulled with an older CLI.

## Rollout and validation

Ship the server and CLI changes together: update CMS, update CLI, then pull to
establish baselines. Older CLIs without the precondition receive 428 on existing
production data. New CLIs reject servers without protocol support, even with
`--force`. The publication workflow also adds a private `site_publications`
collection through an automatic migration. Pull after upgrading to refresh
baselines with the corrected fingerprint scope.

`go test ./...` covers stale/missing revisions, edits during upload, metadata
rollback, backup failure, authenticated backup download and restoration,
library conflicts, export consistency, and bootstrap. CI runs these checks
after building the embedded frontend/common bundles.

The companion CLI has command-level tests plus a real CMS contract test:

```sh
PRIMO_TEST_CMS_BINARY=/path/to/freshly-built/primo node --test tests/push-cms.test.mjs
```

The existing browser suite still pins the published CLI. Update that pin and
its legacy expected-failure round-trip case when the coordinated CLI is
published; the contract test above exercises the new pair before publication.

## Hosted publication

`primo push` saves draft content and prints a scoped `primo publish` command.
`primo publish` compiles the current hosted draft without importing local files.
`primo push --publish` waits for all selected site/library imports before
publishing; an import failure leaves publication unattempted. `--preview` and
`--dry-run` cannot be combined with `--publish`.

Publication uses the hosted token and the site's update permission:

- `GET /api/primo/publication/{siteId}` returns draft/published revisions,
  unpublished changes, last publication, public URL, and the latest attempt.
- `POST /api/primo/publication/{siteId}` with `expected_revision` starts a
  tracked attempt and returns its ID. Active attempts serialize CLI/editor
  publication. An abandoned attempt becomes unknown after 15 minutes and may
  then be replaced by a new attempt.
- The client compiles and uploads all page/symbol artifacts.
- `POST /api/primo/publication/{siteId}/{attemptId}/activate` generates into
  `published/{siteId}/{attemptId}` and rechecks the draft revision and domain
  before atomically saving the active prefix. Site requests resolve that
  prefix; incomplete generation never replaces the active public build.
- `POST /api/primo/publication/{siteId}/{attemptId}/fail` records a compilation
  failure. A delayed failure cannot undo a successful or newer attempt.

Active and previous tracked builds are retained. Older builds and failed
staging files are removed best-effort. Publications performed through legacy
`/generate` clients cannot be attributed to a compile revision and report
unknown freshness. The updated editor uses the same tracked protocol as CLI.

A publication failure preserves successful push baselines and hosted drafts;
the combined CLI command exits nonzero and prints a publication-only retry.
An ambiguous network outcome is reconciled with server status, or reported as
unknown if it cannot be confirmed. JSON reports push and publication separately,
including failed and unattempted targets. Run `primo status --hosted --json`
to inspect authoritative state without uploading or publishing.

The real CMS contract tests cover draft-only pushes, full compilation and public
output, failed publication, retry, and preservation of the push baseline:

```sh
PRIMO_TEST_CMS_BINARY=/path/to/primo node --test tests/push-cms.test.mjs tests/publish-cms.test.mjs
```
