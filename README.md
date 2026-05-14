# Primo [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev) ![](https://img.shields.io/badge/PocketBase-555555?logo=pocketbase&logoColor=white)

Primo is a CMS for developers who build sites for clients who need to manage them afterward. Your entire site stays in sync as both a database and a folder of files, so Claude Code, Cursor, and any AI agent can edit it directly. Your clients manage content visually in the browser.

*In active development since 2019. Self-hosted by freelancers, agencies, and small teams.*

**One-click deploy:**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

![screenshot](https://cdn.primo.page/f52960e1-0bb0-4c64-9f70-5a9994ce95fc/staging/_images/1739675414227Screenshot%202025-02-15%20at%2010.10.10%E2%80%AFPM.png)

## The shape of it

One Go binary. PocketBase (SQLite) for storage. Svelte 5 for the editor UI and for the blocks you write. The same server hosts the CMS and serves your published sites — no external services, no separate frontend to wire up.

Every site lives in two synchronized representations: a relational database (powering the visual editor and multi-site serving) and a folder of structured files (powering code editors, version control, and AI agents). Edit either side, both stay in sync.

## The workflow

```bash
primo pull yourserver.com       # pull your site down as local files
claude                          # edit with Claude Code, Cursor, or any agent
primo push                      # push changes back — CMS updates live
```

Your clients keep editing content in the browser the whole time. Code and content stay in sync.

## What's in the box

- **Visual editor** — non-technical editors work within the guardrails you define. No more "I broke the site" texts.
- **Block library** — reusable Svelte components, shared across all your sites.
- **Static output** — clean, fast, SEO-friendly HTML. Deploy to any static host, or let Primo serve it.
- **Multi-site** — one server, many sites, one dashboard. Connect a domain per site.
- **Local-file workflow** *(beta)* — pull/edit/push with the CLI, AI-agent compatible.

## Quickstart

The easiest way to get started is Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

Or run it anywhere Docker runs:

```bash
docker run -d -p 8080:8080 -v primo-data:/app/pb_data ghcr.io/palacms/palacms:latest
```

Then open your server's URL to create your first site.

**Next steps:**
1. **[Quickstart](https://docs.palacms.com/getting-started/quickstart)** — key concepts
2. **[Build your first site](https://docs.palacms.com/building-sites/your-first-site)**
3. **[Write your first block](https://docs.palacms.com/building-sites/writing-components)**

## Who it's for

Freelancers, small agencies, and small teams who code their clients' sites and need the clients to manage content afterward — without breaking anything.

If you're building a web app, Primo isn't it — check out [tinykit](https://github.com/tinykit-studio/tinykit).

## How Primo compares

- **vs. WordPress** — same mental model (CMS + blocks + multi-site) but built on modern tooling: Svelte instead of PHP, static output instead of server rendering, one binary instead of themes + plugins + hosting.
- **vs. Webflow / Framer** — your clients get a similar visual editor, but you write real code instead of using a proprietary builder. Self-hostable, no vendor lock-in.
- **vs. Astro / Eleventy** — Primo is a static site generator too, but bundles the CMS, block library, and multi-site hosting with it. You get the SSG workflow *and* the client handoff.
- **vs. Sanity / Storyblok** — structured content and component blocks, but monolithic: no separate frontend to wire up, no API tokens, no deployment glue.

[Full comparison →](https://docs.palacms.com/comparison)

## Project status

- **Stable:** visual CMS, block library, static output, multi-site, self-hosted deployment.
- **Beta:** CLI + local-file workflow (`primo pull` / `primo push`), AI-agent compatibility.

## Documentation

- **[Installation](https://docs.palacms.com/getting-started/installation)** — self-host or run locally
- **[Quickstart](https://docs.palacms.com/getting-started/quickstart)** — key concepts
- **[Writing Blocks](https://docs.palacms.com/building-sites/writing-components)** — Svelte components
- **[Field Types](https://docs.palacms.com/reference/field-types)** — content field reference
- **[Managing Sites](https://docs.palacms.com/dashboard/managing-sites)** — site groups
- **[Page Types](https://docs.palacms.com/building-sites/defining-page-types)** — custom page structures
- **[Collaboration](https://docs.palacms.com/collaboration/inviting-collaborators)** — working with editors
- **[Keyboard Shortcuts](https://docs.palacms.com/reference/keyboard-shortcuts)**

## Community

- **[GitHub Issues](https://github.com/primocms/primo/issues)** — bugs and feature requests
- **[GitHub Discussions](https://github.com/primocms/primo/discussions)** — questions
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — if you want to hack on Primo itself

## License

[MIT](./LICENSE)
