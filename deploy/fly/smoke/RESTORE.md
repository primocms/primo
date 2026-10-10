# Snapshot restore drill

Completed 2026-10-04 using synthetic data in `primo-hosted-smoke`.

- Original Machine: `8940edb6d97de8`
- Original volume: `vol_v8eq2dqppmq8xjkv`
- Snapshot: `vs_Aq6VPKe2GZYwIxAx3QZZYj4`
- Snapshot created: `2026-10-04T22:24:43Z`
- Snapshot size: 44,019,289 bytes; seven-day retention
- Temporary restored volume: `vol_v3gk2koxxx60mww4` (removed after verification)
- Temporary private Machine: `8469e7b222e738` (removed after verification)

The source was gracefully stopped before snapshot creation and restarted after
the snapshot reached `created`. The snapshot was restored into a separate 1 GB
encrypted volume. A temporary Machine ran the identical image with that restored
volume, without public services or bootstrap credentials. Its configuration was
checked to confirm it used the new volume and had no public routing.

The verifier connected through a localhost-only Fly tunnel. Without `--seed`, it
verified customer and superuser sign-in, the disabled public installer account,
stored plan limits, database records, exact uploaded bytes, published HTML, and
published upload bytes. The original public server also passed its normal HTTPS
and wildcard-routing checks after the drill. Recovery did not overwrite or change
the original storage.

## Repeat safely

Use the smoke app only. Choose a fresh temporary Machine/volume name and record
all returned identifiers. Do not clone the source Machine's public services:
restored SQLite copies must not both receive customer traffic.

1. Gracefully stop the source with SIGTERM and ensure it stays stopped while
   taking the snapshot. Restart it in a `finally`/cleanup path, even if snapshot
   creation fails. In a real maintenance window, prevent incoming traffic from
   triggering auto-start while taking the snapshot.
2. Run `fly volumes snapshots create <source-volume> --app primo-hosted-smoke`.
   Wait until `fly volumes snapshots list <source-volume> --json` reports the new
   snapshot as `created` before restarting the source.
3. Create a fresh temporary volume:

   ```sh
   fly volumes create pb_restore --app primo-hosted-smoke --region iad --size 1 --snapshot-id <snapshot-id> --snapshot-retention 1 --scheduled-snapshots=false --yes
   ```

4. Boot the pinned smoke image on that volume using `fly machine run`. Use a
   minimal config containing only `app` and `primary_region`; no HTTP services,
   ports, or bootstrap secrets. Set environment values explicitly with `--env`:
   `PRIMO_HOSTED_MODE=true`, `PRIMO_SITE_CAP=3`,
   `PRIMO_BASE_DOMAIN=fly-smoke.primo.page`, and `PRIMO_DOMAIN_PROVIDER=manual`.
   Mount `<restored-volume-id>:/app/pb_data`, use 512 MB RAM and `--restart no`.
5. Inspect `fly machine status <restore-machine> --display-config` to verify the
   volume and absence of services. Open a localhost-only tunnel to its returned
   private IP:

   ```sh
   fly proxy 18080:8080 <restore-private-ip> --app primo-hosted-smoke --bind-addr 127.0.0.1
   ```

6. Verify existing recovered data; never seed it:

   ```sh
   python3 deploy/fly/smoke/verify.py --restore-proxy --url http://127.0.0.1:18080 --credentials /path/to/private/smoke.env
   ```

7. Close the tunnel, remove only the temporary Machine and its restored volume,
   then run the normal verifier against `https://fly-smoke.primo.page`.

The workspace-installed CLI requires
`FLY_CONFIG_DIR=/Users/mateo/Desktop/primo/.tools/fly/config`.

This proves restoration from a stopped-server snapshot. It does not prove live
snapshot consistency or provide a complete production backup policy. Define
acceptable data loss and recovery time, and add application-consistent off-volume
backups before customer rollout. Fly snapshots are retained for a finite period
and daily snapshots can omit newer writes.

Reference: <https://docs.fly.io/volumes/snapshots/>
