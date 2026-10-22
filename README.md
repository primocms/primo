<br />

<p align="center">
  <img src="./static/primo-symbol-badge.svg" alt="Primo symbol" width="64" height="64" />
</p>

<h1 align="center">Primo</h1>

<p align="center">
  <strong>The open-source CMS for developers and their clients.</strong><br />
  Build with Claude Code, Codex, Cursor, or whatever comes next.<br />
  Let clients edit content visually.
</p>

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="https://docs.primo.build">Documentation</a> ·
  <a href="https://primo.build">Website</a> ·
  <a href="https://primo.build/#marketplace">Marketplace</a>
</p>

<p align="center">
  <a href="./LICENSE">MIT licensed</a> · Self-hosted · In active development since 2019
</p>

https://github.com/user-attachments/assets/6675cf96-6fdc-41fc-98f9-311060417e00

## Get started

Paste this into your coding agent:

```text
Create a new Primo site for [my business or project]. Read the quickstart
at https://docs.primo.build/getting-started/quickstart before starting.
Install the Primo CLI, set up a local workspace, help me choose a
marketplace starter, and open the site in the Primo editor.
```

Your agent can handle local setup and help you build the site. When you're ready to share it, ask it to guide you through deploying an editable CMS with `primo deploy`.

<details>
<summary>Prefer the terminal?</summary>

Install a supported Node.js LTS release, then run:

```bash
npm install -g primo-cli
primo init my-workspace
cd my-workspace
primo new my-site
```

`primo init` offers to connect your agent to the Primo MCP tools. `primo new` creates a site and starts the local CMS in an interactive terminal. From a script, start the editor with `primo dev`.

</details>

<details>
<summary>Start with a deployed server</summary>

Deploy Primo on Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

Or run it with Docker:

```bash
docker run -d -p 8080:8080 -v primo-data:/app/pb_data ghcr.io/primocms/primo:latest
```

Open your server's URL to create your first site. See the [quickstart](https://docs.primo.build/getting-started/quickstart) for both local and hosted workflows.

For Railway updates, use `ghcr.io/primocms/primo:latest` to track releases. Older deployments using `:main` can switch to `:latest`; `:main` tracks rolling branch builds.

</details>

## Overview

Primo gives developers control over their sites and clients a visual editor for managing content. Build pages from reusable Svelte blocks, define what can be edited, and manage multiple client sites from one dashboard.

Your site stays in sync as both a database and a folder of structured files. Work in your code editor or with an AI agent; clients keep editing in the browser.

## Features

- **Visual content editing** — edit text, images, and links directly on the page, with structured fields for more complex content.
- **Reusable blocks and page types** — define layouts, conditional fields, and repeaters that clients can work within.
- **Multiple sites, one dashboard** — organize client sites into groups and connect a domain to each one.
- **Static publishing** — generate fast HTML and assets, served by Primo or deployed to another static host.
- **A workflow for code and AI** — pull your sites and shared library into local files, edit them with your preferred tools, and push changes back to the CMS. Currently in beta.

## The workflow

```bash
primo pull yourserver.com   # pull sites and the shared library
claude                      # work with Claude Code, Cursor, or any agent
primo push                  # save changes to the hosted draft
primo publish               # publish the draft to the live site
```

Clients manage content in the browser throughout. Revision checks protect their edits when you push changes; an explicit overwrite saves a backup. See [safe pushes and upgrade instructions](./SAFE_PUSH.md).

## Built with

One Go binary, PocketBase with SQLite for storage, and Svelte 5 for the editor and your blocks. The same server runs the CMS and serves your published sites.

## Project status

The visual CMS, block library, static output, multi-site management, and self-hosted deployment are stable. The CLI and local-file workflow are in beta.

## Learn more

- [Documentation](https://docs.primo.build) — installation, fields, page types, collaboration, and publishing.
- [How Primo compares](https://docs.primo.build/comparison) — WordPress, Webflow, Astro, and headless CMSs.
- [GitHub Discussions](https://github.com/primocms/primo/discussions) — questions and ideas.
- [GitHub Issues](https://github.com/primocms/primo/issues) — bug reports.
- [Contributing](./CONTRIBUTING.md) — help build Primo.

## License

[MIT](./LICENSE)
