# Actual device and client handoff checks

The automated device script uses an existing W3C service and clears only a public-page smoke probe. Do not substitute Linux WebKit, a resized desktop viewport or a mobile emulator for actual Safari/physical-device evidence. Supported OS/browser floors need an owner decision.

## Matrix and evidence

| Required target | Access needed | Initial status |
| --- | --- | --- |
| macOS Safari | Operator-enabled Safari automation and existing W3C endpoint; actual Safari/version | NOT_RUN |
| Physical iPhone Safari | Existing device service, physical-device attestation, model and iOS/Safari versions | NOT_RUN |
| Physical Android Chrome | Existing device service, physical-device attestation, model and Android/Chrome versions | NOT_RUN |
| iPad Safari | Same details, if tablet support is in the agreed scope | SCOPE_UNCONFIRMED |

Use one `device-results.local.json` per device, starting from `device-results.example.json`. Record UTC timestamps, operator, model, OS/browser versions, viewport, physical or emulator status, exact candidate identity, ingress/public URLs, sanitized evidence paths and each step's outcome. Keep devices/accounts private; remove inbox addresses/tokens from screenshots and logs before sharing. Record focus/keyboard findings even if the public probe passes.

The public script verifies five expected headings are visible, checks viewport overflow, performs a native click on the first counter, verifies `Count 1` and unchanged heading nodes during that interaction, then reloads and checks content plus reset state. It attempts to close its session on failure. It does **not** prove initial SSR hydration node identity, editor permissions or publication. The frozen exact-package browser suite supplies separate SSR/hydration evidence.

## Manual editor checklist on an existing disposable fixture

- [ ] Confirm the supported-version target, actual hardware/OS/browser and normal certificate validation. Open CMS and public URLs through the real staging ingress.
- [ ] Sign in with the controlled content editor. Confirm only the assigned site is visible and design/code/page-type/schema settings are unavailable.
- [ ] Open a page, change a heading, save, reload and open a second tab. Confirm the same text persists in the draft; do not expect the public page to update without publishing.
- [ ] Add/edit/delete a nested repeater item, reorder at both levels, save and reload. Compare item IDs, values, order and parent/field bindings against the before snapshot. Check empty repeater behavior and undo where available.
- [ ] Use Tab/Shift-Tab on desktop; on mobile test the on-screen keyboard, focus/scroll, dropdowns, dialogs and touch/drag reorder. Confirm controls remain reachable in portrait and landscape, with no clipped dialogs or horizontal page overflow. Record any browser-specific failure with a screenshot/video and step.
- [ ] Open another editor tab, make conflicting changes on a **reserved** non-soak test record, and verify a clear conflict/reload flow without lost content. Do not run this concurrently on the soak canary.
- [ ] Sign out and back in. Confirm session handling and saved data. Reopen the public page and run the public interaction smoke probe.
- [ ] Restore manual test content only after comparing for other edits. Keep before/after data evidence and verify unchanged identities/relationships. Do not blindly replay a whole-site backup over a concurrent writer.

Mutating permission API regressions already live in the frozen candidate's automated tests. Do not try to change source/schema on an external server merely to test rejection under this preparation task.

## Lifecycle steps blocked by current instructions

- [ ] **NOT_RUN — invite second user through actual mail**, accept it in the controlled inbox, verify correct site/role and invitation failure/resend behavior. Requires SMTP/inbox access and later explicit outbound-mail authorization.
- [ ] **NOT_RUN — publish as developer, edit as client and republish**, compare the actual public response/assets through CDN with the approved draft, then recheck counter and nested content. Requires later permission to publish on the disposable target.
- [ ] **NOT_RUN — custom-domain attach, DNS/ACME and renewal**, including certificate chain and routing for a disposable owned domain. Requires later authority for provider/DNS mutations.

Leave these statuses blocked when access or authority is missing. Passing the public probe or draft editing never clears them. All release PRs remain draft; no merge, registry publication or deployment is part of this checklist execution.
