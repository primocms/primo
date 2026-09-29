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
output, thumbnails, domain state, presence, analytics, and publish snapshots
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
`--force`. No database migration is needed.

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
