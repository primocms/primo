# Recovery plan — restore a copy, preserve the source

This is an operator plan plus a disposable rehearsal. It performs no live recovery. Production and real customer databases must never be used for destructive tests. Keep original RC.7 artifacts/evidence and pre-change backups immutable.

## Required recovery record

- Exact previous and candidate executable/image digests and version/source identity.
- Consistent pre-change database **and** uploaded/compiled storage snapshot, checksum, timestamp and protected settings/key material needed to open it. Include external storage configuration only in a protected backup; never put credentials in the release evidence.
- Expected site/page/section/field/entry IDs, nested leaf values/order, scoped roles/users, uploaded file hashes and active publication. Check both authentication and public output; a healthy process alone is insufficient.
- Named operator, restore destination, DNS/traffic switch owner, last known good time and expected write-loss window. RPO equals the most recent verified consistent backup; do not promise zero lost post-backup writes or a measured RTO without evidence.

## During an incident

1. Pause affected writers/publications and record the failure and last known good state. Preserve a protected forensic copy of the failed candidate data and private logs; sanitize any shared diagnostics. Do not overwrite or delete the only recent data copy.
2. If publication failed but the previous active build remains correct, keep that live build. Repair the failing input and verify a guarded retry on a copy. Do not force a stale source import to make the screen green.
3. For deployment/data rollback, create a **different empty data directory or volume**. Verify the original pre-change backup hash, restore a copy into that destination, and start the matching previous executable there. Never run the older executable directly against the upgraded/mutated data directory. Preserve the candidate data separately for later reconciliation.
4. Before traffic changes, compare IDs/values/order/roles/file hashes and active publication with the recorded inventory. Test user login, client content/source boundaries, public hydration/interactions, HTTPS/headers/cache and the backup checksum again. Check outgoing mail/storage configuration before starting background services; a restored QA snapshot must not accidentally send mail to real people.
5. Only after separately authorized traffic/deployment changes, return the verified target to service and recheck it through the actual ingress. Keep writes paused until its recovery boundary is understood. Reconcile authorized post-backup content from the preserved candidate copy; retain both snapshots until the owner accepts recovery.
6. RC.7 has the old permissive framing header. If it is the recovery executable, the accepted same-origin policy still needs an approved, tested ingress control or another verified safe candidate. Do not silently relax the client-launch contract during rollback.

## Rehearsal scope

`tests/staging/rc8/recovery.test.mjs` accepts only the supplied exact candidate/prior local binaries and creates a fresh temporary root. It seeds generated records, operates over loopback, stops all writers before copying data, upgrades a copy, checks stable content/roles/files/publication, verifies that the backup hash is unchanged, then restores a different copy and starts the previous executable. It cannot select an existing customer data directory. The native production and exact-package handoff checks separately exercise production validation and real CLI/browser publication paths.

Run the rehearsal only with the checksum-verified RC.7 and RC.8 binaries from the local kit. Its generated accounts/files and temporary data are removed at completion; share only the sanitized result. A successful synthetic rehearsal does not clear a representative legacy/customer migration gate or prove the chosen pilot host's operational restore time.
