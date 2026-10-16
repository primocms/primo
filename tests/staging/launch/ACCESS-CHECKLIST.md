# Access to supply, in priority order

Supply local secret-manager references or ignored local files; do not paste passwords, tokens or backups into GitHub or chat. No production credentials are needed. This preparation does not authorize merge, registry publication, deployment, external fixture publication, invitations or outbound mail.

| Priority | Supply | Gate this enables | Minimum scope / fixture |
| --- | --- | --- | --- |
| 1 | Sanitized consistent native PocketBase backup (preferred ZIP) or offline data directory; separate uploads if externally stored; owner SHA-256; source Primo/PocketBase versions; upgrade/custom-migration history; expected IDs/counts/order and reference images | Representative upgrade and backup/restore on disposable copies | Local file access only; see FIXTURE-CHECKLIST.md. Never a live production data directory. |
| 2 | Existing disposable RC.7 CMS HTTPS URL, five-section public QA fixture URL(s), unique marker; actual running executable hash/provenance; test account references and fixture IDs; host CPU/RAM/disk limits | Production validation through real ingress; ten-editor soak | `staging.local.json`, ten separate site-scoped editor users and sites, no server-wide roles. A separately scoped developer test account is needed for the manual handoff; the automated soak does not need it. |
| 3 | Read access to staging application/proxy/CDN logs and configuration, DNS records/certificate status; host metrics export/dashboard; staging app settings inspection | Proxy, cache, TLS and workload observation | Read-only access or sanitized exports is sufficient for present checks. DNS/ACME changes and publication-driven invalidation remain NOT_RUN until separately authorized. |
| 4 | Existing Safari W3C endpoint; existing physical iPhone Safari and Android Chrome browser endpoints; provider credentials/capabilities; exact OS/browser/model and physical-device attestation; supported OS floor; iPad if supported | Actual Safari/mobile public smoke and manual editor checklist | Device sessions only, no app installation/settings changes by this runner. Export `PRIMO_QA_*_WEBDRIVER_URL` and any provider variables listed in secrets.example.env. Emulators do not clear physical-device gates. |
| 5 | Proposed workload acceptance, duration, staging hardware, real hosting metrics and a monitoring observer | Capacity/soak acceptance | Confirm or replace one hour / ten editors / ten-second intervals / p95 public ≤1000 ms / save roundtrip ≤2000 ms / zero errors. Set `criteriaConfirmed:true` only after agreement. Reserve scratch records exclusively. |
| 6 | Staging SMTP host/port/TLS mode/auth reference, approved sender, two controlled inboxes with full headers, bounce/failure evidence access | SMTP AUTH/TLS and actual invitation delivery | PRIMO_QA_SMTP_* variables are worksheet inputs, not runtime environment settings. No script uses these credentials or sends mail. Future explicit authorization is needed to send a test invitation. A capture-only sink cannot prove deliverability. |
| Optional | `PRIMO_RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID` for one disposable existing service | Railway-specific domain/provider checks | Omit for manual routing. Supply read-only provider exports first; a mutating provider test needs separately scoped authority. No deployment token is needed for this preparation. |

## Decisions and blocked actions

- Confirm supported Safari/iOS/Android versions (and iPad support). Record actual device model/OS/browser, rather than choosing a convenient emulator.
- Confirm workload limits and host resources. The supplied thresholds are proposals, not an agreed service commitment.
- Resolve invitation failure visibility (monitor/resend versus a product UX change) and the intended framing policy (`frame-ancestors *`). Tests must not silently make these product decisions.
- Content-only permissions protect design source records. Trusted editors currently retain publication by compiled HTML/JavaScript upload. This is the retained publishing model, not a promise that editors cannot change executable output.
- Creating an externally served fixture, inviting a second user, republishing for CDN checks, DNS/provider mutation and mail delivery cannot be completed under the current no-publish/no-deploy instruction. Provide an already-populated fixture for current probes. Record remaining lifecycle steps as NOT_RUN until separately authorized.
- Public registry installation remains blocked by the no-publish instruction. Do not supply npm publishing credentials for this work. The frozen tarballs already allow exact-package testing.

## Return checklist

- [ ] `staging.local.json` filled, private secret references supplied separately.
- [ ] `fixture.local.json` and sanitized backup with independent checksum supplied.
- [ ] Service owner identifies the running native binary and RC.7 artifact provenance.
- [ ] Ten editor-to-site mappings plus a separate developer/client handoff pair supplied.
- [ ] Existing published markers and public headings match the templates.
- [ ] Read-only logs/metrics/proxy/DNS/certificate evidence available.
- [ ] Real-device capabilities and supported-version decision supplied.
- [ ] Soak limits, scratch reservation, observation window and stop contact agreed.
- [ ] SMTP/inbox inputs retained for a later authorized delivery test.
