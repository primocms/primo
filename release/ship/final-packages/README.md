# Prepared stable npm packages — unpublished

Rebuilt November 5 from CLI `77ec9e389eecc72400e7465d5369d6cde2fa3552`
and MCP `14d92557ee5387c7d7eab313b32e6b5632f48093`, including the remaining
release-review fixes. `manifest.json` records the source commits, SHA-256,
and npm integrity of these exact stable archives. Every shipped file except
package metadata is verified byte-identical to a fresh pack of its source build.
CLI declares the matching stable MCP dependency. Preparation uses temporary
clean worktrees and fresh locked dependencies; stale ignored build output
and untracked source cannot enter the archive.

Reproduce from clean checkouts with locked dependencies installed:

```sh
python3 release/ship/prepare-source-packages.py \
  --cli-source /absolute/cli-checkout --mcp-source /absolute/mcp-checkout \
  --output /absolute/empty/output
```

The previous stable archives and qualification are superseded. Local qualification
of these exact installed bytes is recorded in `qualification-local.json`.
The CLI bundles its patched ZIP dependency tree so plain consumer installs retain
the source checkout's dependency fixes. A fresh consumer install reports zero
audit findings. Full Chromium 156 is used locally; final-head CI supplies its own
pinned-browser and cross-platform native qualification.
Published RC.3 archives remain unchanged. No package, image, release or tag
has been published, and registry handoff remains unverified.

Publication remains held. Install both exact local archives together for
qualification; registry installation is a separate gate after explicit
publication authorization. Never relabel an older CMS executable as stable.
