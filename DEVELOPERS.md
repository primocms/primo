# Developer Guide

This guide covers the technical aspects of working **on the Primo codebase itself** - whether you're contributing, forking, or just trying to understand how it works.

> **Looking to build with Primo?** If you want to learn how to create blocks, templates, or sites using Primo, check out our user documentation at [docs.primo.build](https://docs.primo.build).

## 🏗️ Architecture Overview

### Tech Stack

- **Frontend**: SvelteKit 2.x with Svelte 5
- **Backend**: PocketBase with JavaScript hooks
- **Database**: SQLite (via PocketBase)
- **UI Framework**: Tailwind CSS 4 with bits-ui components
- **Code Editing**: CodeMirror 6 with Svelte language support
- **Rich Text**: TipTap editor (built on ProseMirror 6)

### Project Structure

```
primo/
├── src/                    # Main SvelteKit application
│   ├── lib/
│   │   ├── builder/        # Core page builder components
│   │   │   ├── components/ # Builder UI components
│   │   │   ├── stores/     # Svelte stores for state
│   │   │   ├── utils/      # Utility functions
│   │   │   └── views/      # Builder views (editor, modals)
│   │   ├── common/         # Code shared between frontend and backend applications
│   │   │   └── models/     # Zod data models
│   │   ├── pocketbase/     # PocketBase client & collection mappings
│   │   └── components/     # Shared UI components
│   └── routes/             # SvelteKit routes and pages
|   └── workers/            # Worker functions for Svelte components
├── internal/               # PocketBase server-side code
├── migrations/             # Database schema migrations
├── pb_data/                # PocketBase database & uploaded files
    ├── storage/sites       # Generated sites by host address
```

## 🚀 Development Setup

### Prerequisites

- [devenv](https://devenv.sh/) or [Dev Container](https://containers.dev/supporting) compatible development environment (eg. Visual Studio Code)

### Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/primocms/primo.git
   cd primo
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   # Initial build is required before starting dev server.
   npm run build

   npm run dev
   ```

   This starts both the SvelteKit dev server and PocketBase backend.

4. **Access the application**
   - Main app: `http://localhost:5173`
   - PocketBase Admin: `http://localhost:8090/_`
   - Built app: `http://localhost:8090`

### Available Scripts

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Start development server with devenv               |
| `npm run build`  | Build for production (with increased memory limit) |
| `npm run check`  | Statically check for errors                        |
| `npm run lint`   | Check for code styling issue                       |
| `npm run format` | Format code according to code style                |

## 📝 Core Concepts

### Sites & Pages

- **Sites** contain global content
- **Page Types** define reusable page templates with predefined sections and fields
- **Pages** are individual content items with their own page-level content and sections

### Blocks (called Symbols internally)

- Contain HTML, CSS, and JS powered by Svelte
- Can contain dynamic **Fields** for content editing
- Available in both **Site Library** and **Global Library**

### Fields & Content

- **Site Fields** - Global content that appears across pages (e.g. Logo, Site Navigation, Social Links)
- **Page Fields** - Content specific to individual pages (e.g. Post Title, Event Date, Person Bio)
- **Block Fields** - Content within blocks - each section containing its own entries
- Support for text, rich text, images, repeaters, and conditional logic

## 🗄️ Working with PocketBase

### Database Schema

- Schema changes go in `migrations/`
- Migrations use Golang
- Migrations should be written manually

### Server-side code

- Server-side code exists mostly in `internal/` directory
- Entry point to the server application can be found from `main.go` which exists in the root directory
- Used for tasks such as validation and serving files
- Only the business logic that has no place in the frontend application should be added here

### Collections & Data Access

- Use the CollectionMapping system for reactive data access
- Collections are defined in `src/lib/pocketbase/collections.ts`
- Follow existing patterns for CRUD operations
- Data models are in `src/lib/common/models/`

Example:

```javascript
// Get a site with reactive updates
const site = $derived(Sites.one(siteId))

// Create a new page locally (staged for a commit)
const newPage = Pages.create({
	name: 'New Page',
	slug: 'new-page',
	site: siteId
})

// Update page name locally (staged for a commit)
Pages.update(pageId, { name: 'Updated Name' })

// Commit all locally made changes to the server
await self.commit()
```

### State Management

- **Global state**: Use Svelte stores in `$lib/builder/stores/`
- **Component state**: Keep local with `$state()` when possible
- **Context**: Use for deeply nested component communication
- **URL state**: Use SvelteKit's page store for shareable state

### Styling Guidelines

- Use Tailwind CSS classes for styling
- Custom CSS in component `<style>` blocks when needed
- Follow existing color and spacing patterns
- Use CSS custom properties for theme values

## 🐛 Debugging & Troubleshooting

### Common Issues

**Build Errors**

```bash
# Increase Node memory for large builds
NODE_OPTIONS=--max_old_space_size=16384 npm run build
```

**PocketBase Issues**

- Check `pb_data/` permissions and ownership
- Verify migrations have run successfully
- Check PocketBase logs in the terminal
- Use PocketBase admin UI at :8090 to inspect data

**Type Errors**

```bash
# Get detailed TypeScript diagnostics
npm run check

# Check specific file
npx svelte-check --watch
```

**Performance Issues**

- Use browser DevTools Performance tab
- Check for unnecessary rerenders with Svelte DevTools
- Profile database queries in PocketBase admin

### Development Tips

1. **Hot Module Replacement**: The dev server supports HMR for fast iteration
2. **Browser DevTools**: Use Svelte DevTools extension for component inspection
3. **PocketBase Admin**: Use the admin UI at :8090 to inspect and modify data
4. **Console Debugging**: Use `$inspect()` rune for reactive debugging
5. **Network Tab**: Monitor API calls to PocketBase

## 🚀 Deployment

## Prebuilt Docker Images

Prebuilt Docker image can be found from GitHub Container Registry:

```
ghcr.io/primocms/primo
```

### Manual Build

```bash
# Build the application
npm run build

# Start development environment for previewing the build
npm run dev

# To preview the build locally open http://localhost:8090 while development environment is running.

# Actually build Docker image tagged as "primo"
docker build -t primo .
```

### Environment Setup

The app uses these environment variables during the initial start to optionally create up to two initial users:

- For initial superuser:
  - PRIMO_SUPERUSER_EMAIL
  - PRIMO_SUPERUSER_PASSWORD
- For initial Primo user:
  - PRIMO_USER_EMAIL
  - PRIMO_USER_PASSWORD

The container requires volume to be mounted on path `/app/pb_data` for storing files and a SQLite database.

For production deployments, see the [PocketBase deployment documentation](https://pocketbase.io/docs/going-to-production/).

### Hosting Options

- VPS with Docker
- Cloud services like Railway, Fly.io

## 📚 Code Style & Patterns

### TypeScript

- All new code should be TypeScript
- Data models extend base types from `src/lib/common/models/`
- Use proper typing for Svelte components and stores
- Prefer interfaces over types for object shapes

### File Organization

- Components: PascalCase (e.g., `ComponentName.svelte`)
- Utilities: camelCase (e.g., `utilityFunction.ts`)
- Stores: camelCase (e.g., `userStore.ts`)
- Routes: lowercase with hyphens (e.g., `user-settings/`)

### Naming Conventions

- Use descriptive names that explain intent
- Prefer explicit over clever
- Use consistent naming across similar features
- Follow existing patterns in the codebase

## 🔌 Extending Pala

### Adding New Field Types

1. Create field component in `src/lib/builder/field-types/`
2. Add to field type registry
3. Define TypeScript interfaces
4. Add validation logic

### Creating Custom Views

1. Add route in `src/routes/`
2. Create view components
3. Handle authentication and permissions
4. Add navigation if needed

### Adding PocketBase Hooks

1. Create hook file in `pb_hooks/`
2. Use CommonJS module format
3. Handle errors gracefully
4. Test thoroughly with various scenarios

## 📄 Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Svelte 5 Guide](https://svelte-5-preview.vercel.app/docs/introduction)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [CodeMirror Documentation](https://codemirror.net/)

---

**Questions?** Check existing issues and discussions, or refer to the [Contributing Guide](CONTRIBUTING.md) for how to get help.
