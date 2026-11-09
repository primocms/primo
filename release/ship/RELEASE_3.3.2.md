# 3.3.2 compatibility and upgrade notes

Add these notes to the release description before publication.

- Back up the complete PocketBase data directory (normally `pb_data`) and any
  separately configured file storage before upgrading. Stop writes while making
  a filesystem copy, or use PocketBase's supported backup operation. Keep the
  previous executable/image and verify that the backup can be restored into a
  separate directory. Automatic push backups cover a site's or library's content;
  they are not a substitute for a complete instance backup.
- Rehearse the upgrade on that copy. Database migrations run at startup. For
  rollback, restore the pre-upgrade data and matching previous executable;
  do not run the previous version against an already migrated database.
- Published sites now send `Content-Security-Policy: frame-ancestors 'self'`.
  Same-origin embedding continues to work. Embedding a published site in an
  iframe on another origin is blocked; check existing integrations before upgrading.
- Local development uses `primo-cli@0.3.0` and `primo-mcp@0.1.11`. It requires
  Node 22.13 or newer on the 22.x line, or Node 24 or newer. Building the CMS
  from source requires Node 22.17 or newer on the 22.x line, or Node 24 or newer.
  The standalone CMS executable does not require Node.
- Browser approval for CLI sign-in requires HTTPS when connecting to a server
  outside the local computer.

## Release qualification and package order

The existing draft's binaries predate the review fixes and must be replaced.
Passing runs for an earlier source commit do not qualify the corrected release.

1. Merge the fixes and select the final release commit. Check that the version in
   `tests/staging/rc8-packages.json` matches the intended tag. If an existing draft
   tag points elsewhere, coordinate its replacement before preparing assets;
   do not publish the older draft or silently reuse its binaries.
2. Run all four workflows below on that exact commit, using a branch or tag that
   points to it. `workflow_dispatch` supports qualification after a merge without
   substituting an earlier PR head with an identical source tree:

   ```sh
   gh workflow run rc-platform.yml --ref RELEASE_REF
   gh workflow run e2e.yml --ref RELEASE_REF
   gh workflow run browser-compatibility.yml --ref RELEASE_REF
   gh workflow run staging-preparation.yml --ref RELEASE_REF
   ```

   Wait for all four to pass, including every native platform, installed browser,
   native Safari, recovery and framing job. A newer failed or in-progress run
   blocks reuse of an older success.
3. Publish the qualified CLI archive through the package release process, then
   run `node release/ship/verify-release-packages.mjs`. Both public npm packages
   must match the versions and integrity in `package-lock.json`. MCP 0.1.11 is
   already public; CLI 0.3.0 was unavailable during review. Do not substitute an
   older CLI or a repacked archive.
4. Push the release tag at the qualified commit, or rerun its failed **Build and
   Release Binaries** workflow after qualification completes. The workflow copies
   the five tested executables, records their qualification sidecars and checksums,
   and updates a draft. It does not rebuild them. Review the complete asset set
   and add these compatibility notes to the draft before publishing.
5. Publishing the release builds Docker images from those same qualified Linux
   executables. Both stable and prerelease images verify the source, version,
   checksum, successful qualification run and independently downloaded artifacts.
   Stable publication updates the version, minor, major and `latest` channels.

Local regression tests do not replace the cross-platform qualification above.
