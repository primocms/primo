# Prepared stable npm packages — unpublished

These archives are prepared for MCP 0.1.11 and CLI 0.3.0. They contain the
site-field and batched-upload fixes. `manifest.json` records SHA-256 and npm
integrity, plus the candidate archive each was derived from. Preparation
checks that all shipped files except package metadata are byte-identical to
the candidate archives. CLI declares the exact stable MCP dependency.

Reproduce from the current release inputs:

```sh
python3 release/ship/prepare-final-packages.py --output /absolute/empty/output
```

A disposable offline install of BOTH archives passed real-CMS site-field
publication/export/import/error preservation and the 36 MiB/256 KiB proxy
round-trip. The registry did not contain these proposed versions when checked.
No publication was performed. Do not install only the CLI archive until its
matching MCP version is available: public dependency resolution is a later gate.

These are npm package artifacts, not final CMS native executables. Stable CMS
3.3.2 still needs its stable onboarding version tuple, fresh native builds and
qualification. Current candidate native CI verifies RC.13 with matching RC
archives. Do not relabel an earlier binary as the stable executable.

Publication remains held. After explicit authorization, publish the exact MCP
archive first, refresh source registry locks to its verified integrity, qualify
those final sources/native bytes, make compatible CMS available, and publish
CLI last. Final registry fresh-install verification cannot be completed while
publication is prohibited. Regenerate these archives and hashes if inputs change.
