# Prepared stable npm packages — unpublished

These archives are prepared for MCP 0.1.11 and CLI 0.3.0. They contain the
site-field, batched-upload and publishing-content fixes (MCP #33). Rich-text
marks/links/heading levels and image dimensions now survive CLI publication.
`manifest.json` records SHA-256 and npm
integrity, plus the candidate archive each was derived from. Preparation
checks that all shipped files except package metadata are byte-identical to
the candidate archives. CLI declares the exact stable MCP dependency.

Reproduce from the current release inputs:

```sh
python3 release/ship/prepare-final-packages.py --output /absolute/empty/output
```

The refreshed candidates pass real-CMS browser/Node rich-text serialization
parity, image-dimension preservation, cache/failure protection and all 214 CLI
tests on Node 22.13/24.0, including the 36 MiB/256 KiB proxy round-trip.
These stable archives retain the candidate shipped files except package metadata.
A fresh install of both exact stable archives passed real-CMS publication and
site-field/error preservation on Node 22.13 and 24.0, plus the 36 MiB/256 KiB
proxy contract on Node 22.13. Earlier stable archive/native results keep their
original source identities; these checks do not qualify a new stable CMS binary.
The registry did not contain these proposed versions when last checked.
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
