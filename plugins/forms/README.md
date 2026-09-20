# Forms: first capability-backed plugin prototype

A customizable Svelte block submits to `primo.forms.submit`. Primo validates the
registered schema, stores the submission in PocketBase, and queues an optional
email notification using the server's SMTP settings. No vendor keys belong in
the block. Storage works without SMTP. There is no arbitrary server JavaScript.

This is the first vertical implementation, not a generic plugin marketplace or
adapter registry. `form.json` is an enforced, versioned form definition; generic
`primo plugin check` and marketplace installation are not implemented. `manifest.json`'s
`requires` IS enforced, though — see "Capabilities" below. `PROMPT.md` is the source
for a future marketplace prompt. It has not been published.

## Capabilities

`manifest.json` declares two capability requirements, validated server-side against
the real `PluginManifest` schema (`src/lib/common/plugins/manifest.ts`, run inside
Go via goja — see `internal/plugin_contract.go`): `data` (required) and `email`
(optional). A site must install the plugin — `PUT /api/primo/sites/SITE_ID/plugins/forms`
— before it can register or accept forms at all; `install.mjs` does this
automatically. `email` must additionally be granted (`{"grant":{"email":true}}`,
which `install.mjs` also sends) before a form definition may set `notifyTo`.

Conceptually, `primo.forms.submit` is a scoped action backed by exactly two
capability calls: storing the submission is `primo.data.insert`, and queuing/sending
its notification is `primo.email.send`. Both are enforced server-side at the actual
storage/send boundaries — including for a notification already queued before its
site's `email` grant was revoked — not just at registration time. Uninstalling
(`DELETE` the same URL) revokes every capability the site had granted; it does not
delete any form definition or submission.

## Install

Build/run the updated Primo server (which applies the forms migration). Choose an
existing site workspace with a `blocks/` directory. Obtain a normal authenticated
Primo user token with access to that site; keep it only in the installer process.

```sh
PRIMO_TOKEN=... node plugins/forms/install.mjs https://your-server.example SITE_ID /path/to/site
```

The installer installs the plugin (granting `data` and `email` for that site),
registers the `contact` form, and creates `blocks/contact_form`.
It refuses to overwrite an existing block. Add `contact_form` to a page's sections
and allowed blocks using the existing workspace format, then `primo push` and
publish. As with all dynamic blocks, the server must include the forms runtime.
The example uses same-origin requests on Primo-hosted sites and editor previews.
For an independently hosted static export, set `server_url` to the Primo server
origin and explicitly allow the static site's origin with `CORS_ALLOWED_ORIGINS`.

The private inbox is `/admin/forms?site=SITE_ID`. Sign in first. The API uses the
site's existing update permission to authorize registration and inbox access.
Direct PocketBase access to both collections is locked to superusers.

## Configure and update

Edit `form.json` alongside the block to change fields. Accepted field types are
`text`, `textarea`, and `email`; limits and required flags are checked server-side.
Unknown fields are rejected. Submit a new definition with authenticated
`PUT /api/primo/sites/SITE_ID/forms/contact`. Re-registering that same slug updates
the form in place and retains all submissions. Set `enabled: false` to disable
new submissions without deleting any data. There is no destructive uninstall API.

To request email notifications, add `"notifyTo": "owner@example.com"` to the form
definition and re-register it. Visitors cannot override that address. Notifications
snapshot the recipient at submission time; changing the form doesn't redirect old
notifications. Server operators configure SMTP in PocketBase's mail settings.
Pending notifications wait for SMTP, then are attempted once per minute in batches
of 25, with exponential backoff and a maximum of five attempts. The inbox shows
`off`, `pending`, `sent`, or `failed`. There is not yet a UI for editing forms or
replaying exhausted jobs.

Submitting the same data with the same request ID returns success without creating
another record or job. Keep the ID after a network error; generate a new one if the
visitor changes the data. SMTP is at-least-once: a process crash after sending but
before saving delivery status can duplicate an email. It cannot duplicate the
stored submission. This initial worker targets Primo's single-process deployment.

Public requests are limited to 32 KB, 30 schema fields, and a default 10 requests
per minute per IP through PocketBase's rate limiter. The limit follows the server's
existing rate-limiter enabled setting. The block includes a honeypot. These are
baseline protections, not a full spam filtering service.

## Contract

```js
const { createPrimo } = await import('/api/primo/runtime/forms.js')
const primo = createPrimo({ siteId: 'SITE_ID' })
await primo.forms.submit(
	'contact',
	{
		name: 'Ada',
		email: 'ada@example.com',
		message: 'Hello'
	},
	{ requestId: crypto.randomUUID(), website: '' }
)
```

Anonymous visitors get only submission access to enabled forms. Registration and
inbox reads require authentication and site authorization. `primo.forms` is a
purpose-specific action backed by data and notification processing, not a grant
of arbitrary database writes or mail sending. The browser client is convenience;
the server is the enforcement boundary. It does not isolate arbitrary same-page
scripts from one another.

Administrative routes:

- `PUT /api/primo/sites/{siteId}/plugins/forms` — install/update the plugin's
  capability grants for this site: `{"grant":{"email":true|false}}`. `data` is
  always granted (it's a required capability). Idempotent; safe to re-run.
- `DELETE /api/primo/sites/{siteId}/plugins/forms` — uninstall: revokes every
  granted capability. Form definitions and submissions are untouched.
- `GET /api/primo/sites/{siteId}/plugins/forms` — current grant, or
  `{"installed":false}`.
- `PUT /api/primo/sites/{siteId}/forms/{slug}` — register/update definition.
  Requires the plugin to be installed (`data` granted); setting `notifyTo`
  additionally requires `email` granted.
- `GET /api/primo/sites/{siteId}/forms` — definitions and SMTP availability.
- `GET /api/primo/sites/{siteId}/forms/{slug}/submissions?page=1` — private inbox,
  50 records per page, with `hasMore`.

Public route:

- `POST /api/primo/forms/{siteId}/{slug}/submit` — JSON `{ data, requestId, website }`.
  Returns `202 { accepted: true }`; acceptance means saved, not email delivered.

The collections are runtime data, currently outside `primo pull`/`push` exports.
Keep form definitions under version control and use normal PocketBase backups for
submissions. A form schema update affects future submissions; old data keeps its
original shape. Removing the form via a superuser or deleting its site cascades to
submissions, so export/backup before doing that.

## Verify

```sh
go test ./internal -run '^Test(Form|PluginInstall|PluginContract|NotificationDelivery|Visitor)' -count=1
```

`TestForm*` covers registered-form validation, anonymous versus authenticated
access, private collection APIs, idempotent retries, preserved data on update,
honeypot, disabled forms, and durable notification retry without a real SMTP
connection. `TestPluginInstall*`/`TestPluginContract*`/`TestNotificationDelivery*`/
`TestVisitor*` (`internal/plugin_capabilities_test.go`) cover install/uninstall
against a real server, denied storage without the `data` capability, denied
sending without (and after revoking) `email` — including an already-queued
notification — visitor escalation attempts, cross-site isolation, install
idempotency, and that the manifest is enforced against the real TS schema.
