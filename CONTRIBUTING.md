# Contributing to Primo

Thank you for your interest in contributing to Primo! In the interest of full transparency, we want to be up front in this doc to avoid hurting feelings and set clear expectations.

## About Primo

Primo is a business-driven open source project (think NextJS, Supabase, Tailwind CSS) rather than a community-driven one like Linux or Apache. We're building a sustainable business around a high-quality open source tool, which means:

- We maintain control over project direction
- We have limited bandwidth for reviewing external contributions
- We encourage you first to fork and modify for your own needs (hence the MIT license)

## Before You Contribute

**Always discuss first.** We have limited time for reviews and will likely close PRs submitted without prior discussion.

- **For bugs**: Open an issue describing the problem
- **For features**: Open a discussion explaining why it's needed
- **Wait for confirmation** before starting work
- Bug fixes are more likely to be accepted than new features

## 📚 Technical Documentation

For detailed technical information including architecture, development setup, and code guidelines, see:

**[DEVELOPERS.md](DEVELOPERS.md)** - Complete technical guide covering:

- Architecture overview and project structure
- Development setup and available scripts
- Core concepts (Sites, Pages, Symbols, Fields)
- Working with PocketBase (database, hooks, collections)
- Component development with Svelte 5
- Testing guidelines and debugging tips
- Deployment and hosting options

## 🔄 If You Want to Contribute

We genuinely appreciate contributions! However, since Primo serves a broad range of users and use cases, we need to be thoughtful about changes to protect the project's general-purpose nature and long-term vision.

### Step 1: Discuss First

**This is mandatory.** We will likely close PRs that skip this step.

1. **For bugs**: Open an issue describing the bug
2. **For features**: Open a discussion explaining the feature and why it's needed
3. **Wait for response**: A maintainer will let you know if we're interested
4. **Get confirmation**: Only start work after getting explicit approval

### Step 2: Make Your Changes

If you've received approval to proceed:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Follow code style**
   - Run `npm run format` before committing
   - Follow existing patterns in the codebase

### Step 3: Submit PR

1. **Reference the issue/discussion** in your PR description
2. **Provide clear description** of what changed and why
3. **Include screenshots** for UI changes
4. **Be patient** - Reviews may take time

### What We're Looking For

**More likely to accept:**

- Bug fixes with clear reproduction steps
- Documentation improvements
- Performance optimizations
- Accessibility improvements

**Less likely to accept:**

- Large feature additions
- Breaking changes
- Changes that increase complexity significantly
- Features that duplicate existing functionality

## 🤝 Forking Primo

If you want to create your own version of Primo:

1. **Fork freely** - The codebase is open source for a reason
2. **No approval needed** - Make whatever changes you want in your fork
3. **Share back** - If you make improvements that could benefit everyone, consider a PR (following the guidelines above)
4. **Attribution** - Please maintain attribution per the license

## 📚 Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [CodeMirror Documentation](https://codemirror.net/)
- [TipTap Documentation](https://tiptap.dev/)

## 📄 License

Primo is MIT licensed, which means:

- **You can build proprietary products** on top of Primo without sharing your code
- **You can fork and modify** without contributing back
- **You can use it commercially** without restrictions
- **Any code you contribute** to the main Primo repository will be MIT licensed

By contributing to Primo, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for your interest in Primo!** Whether you're forking for your own use or contributing back, we appreciate you and hope the code serves you well.
