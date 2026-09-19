# Analytics

Primo sends a small set of privacy-conscious product events to PostHog so we
can answer activation questions ("do new sites reach publish?", "how long
does that take?", "who comes back?") without collecting content or PII.

Implementation: [`src/lib/analytics.ts`](src/lib/analytics.ts) (event
definitions), [`src/lib/PostHog.ts`](src/lib/PostHog.ts) (SDK init/consent
gate), [`internal/info.go`](internal/info.go) +
[`internal/stats.go`](internal/stats.go) (server-side enablement).

## Enablement

| Deployment | Default | Override |
|---|---|---|
| Self-hosted (`PRIMO_HOSTED_MODE` unset) | **Off** | `PRIMO_ENABLE_USAGE_STATS=true` to opt in |
| Hosted (`PRIMO_HOSTED_MODE=true`) | **On** | `PRIMO_ENABLE_USAGE_STATS=false` to opt out |

The server exposes the resolved value as `telemetry_enabled` on
`GET /api/primo/info`. The client (`PostHog.ts`) only calls `posthog.init()`
when that flag is true, and every event in `analytics.ts` re-checks it before
sending — so flipping the env var off stops all reporting immediately on next
load, both for the daily instance heartbeat (`stats.go`) and for the product
events below.

Local development (`PRIMO_DEV_MODE=1`, i.e. `npm run dev`) never sends
events, independent of the above — see `instance.dev_mode` gate in
`analytics.ts`.

## Events

All events carry `instance_id` (the server's random, non-identifying UUID)
and `hosted_mode` (bool). The PostHog `distinct_id` is the signed-in editor's
opaque PocketBase user id when known, falling back to `instance_id` — this
lets you tell "one account did everything" from "N editors on one server"
without ever sending an email address.

### `site_created`
A new site record finished creating (server confirmed the clone/import).
Fired once, right after `POST /api/primo/clone-site` returns 200 — not on
button click, and not before the optional starter-block copy that can follow.

| Property | Meaning |
|---|---|
| `site_id` | Opaque id of the new site |
| `source` | `local` (cloned from an existing site), `marketplace`, or `file` (uploaded snapshot) |

### `content_saved`
A content field (site/page/section entry) was successfully persisted —
fired once per server-confirmed write, not per keystroke. Debounced client
edits are batched before this fires (500ms idle), so a burst of typing is one
event, not one per character. Does **not** cover structural changes (creating
pages, page types, blocks, or role assignments) — those aren't "content."

| Property | Meaning |
|---|---|
| `is_return_activity` | `true` if this is the first save-worthy event for this editor (or instance, if signed out) on a different calendar day than their last one — the "did they come back" signal |

No `site_id`: the underlying write path (`CollectionManager.commitChanges`)
doesn't carry one without an extra lookup, and the account/editor dimensions
already answer the return-usage question this event exists for.

### `site_published`
A publish completed: pages compiled, snapshot recorded, and the change
committed. Fired once at the end of `handle_publish`, after everything
(including snapshot pruning) has succeeded.

| Property | Meaning |
|---|---|
| `site_id` | Opaque id of the published site |
| `is_return_activity` | Same day-bucketed definition as `content_saved`, keyed by site |

### `collaborator_added`
A `site_role_assignments` record was successfully created for a new
collaborator, via either the email-invite flow or the shareable-link flow.

| Property | Meaning |
|---|---|
| `site_id` | Opaque id of the site they were added to |
| `method` | `invite` (email) or `link` (generated login link) |

### `operation_failed`
A save/create/publish operation raised an error the user would see (i.e. it
blocked them) — not a caught-and-retried background hiccup. Never includes
the raw error message, stack, or any URL; only a coarse category.

| Property | Meaning |
|---|---|
| `operation` | `site_create`, `content_save`, `publish`, or `collaborator_add` |
| `category` | `network`, `validation`, `permission`, `compilation`, `server`, or `unknown` — see `categorize_error()` |
| `site_id` | Present when the operation is scoped to a site (absent for `site_create`, which doesn't have one yet) |

`content_save` errors are not currently wired up: the debounced
`self.commit()` call sites for individual field edits are fire-and-forget by
design (so typing never blocks on network), so there's no single call site
that both catches the failure and knows the user is still looking at it. If
this becomes a priority, it likely needs a visible retry/error UI for saves
first — tracking the error is the easy part.

## What's never sent

Page/field content, images, tokens, passwords, email addresses, raw error
messages, and URLs that could encode private data. `analytics.ts`'s
`sanitize_properties()` only forwards primitive values from an explicit
allowlist per event — there's no generic "attach these properties" call site
that could accidentally widen what's collected.

## Answering the activation questions

These map directly to PostHog insights (see the 4 saved insights linked from
the PR description, or build your own):

- **Created but never published**: funnel `site_created` → `site_published`,
  breakdown by `site_id` unconverted, or a HogQL query using `argMin`/`argMax`
  timestamps per `site_id`.
- **Time to first publish**: same funnel, "average time to convert" — the
  interval between an account's first `site_created` and *its* `site_published`.
- **Returns on another day**: trend of `content_saved` / `site_published`
  filtered to `is_return_activity = true`, breakdown by `distinct_id`.
- **Errors blocking activation**: trend of `operation_failed`, breakdown by
  `operation` and `category`.

## Known gaps / follow-ups

- No JS/TS test runner exists in this repo (`primocms/package.json` has no
  `test` script). Verification for `analytics.ts` is: `svelte-check` (clean),
  the three enablement scenarios curled against a live built binary
  (hosted-default-on, self-hosted-default-off, self-hosted-opt-in — see PR),
  and code review of the gating logic. No live PostHog ingestion was
  verified — see the PR description for what was and wasn't confirmed.
- `devenv.nix` still sets the old `PRIMO_DISABLE_USAGE_STATS=true` for local
  dev. It's inert now (self-hosted already defaults off, and `dev_mode`
  independently blocks all events), but worth cleaning up in a follow-up so
  it doesn't imply the old variable name still does something.
- `content_saved` has no `site_id` and no error variant (see above).
