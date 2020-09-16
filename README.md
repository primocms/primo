<p align="center">
  <img src="readme_assets/logo.svg" alt="logo"/>
</p>

<p align="center">
  <img src="readme_assets/comic.png" alt="comic"/>
</p>

# primo is a page builder for developers 

Despite all the advancements that have been made in web development, developers looking to build editable static sites still find themselves at the mercy of either limited/buggy no-code page builders like Squareix, or overly-powerful frameworks like Next wired up to the latest and greatest Ned Stark CMS. primo solves this by being *both* an IDE *and* a CMS. And since it combines both, a whole range of benefits open up that would be tough to pull off otherwise. 

**For developers:**
  * Edit pages component-by-component (as opposed to file by file)
  * Integrate component/page/site fields in literal seconds
  * Use Tailwind & JS modules without *any* setup
  * Create a component library (we call it a Symbol Library) 
  * Build a static site that can be hosted anywhere for dirt cheap

**For content editors:**
  * Edit editorial content on the frontend (like a Squareix, but better)
  * Edit structured content in clearly defined fields
  * Use the Symbol Library to build entire pages


<p align="center">
  <img src="readme_assets/screenshot.png" alt="screenshot"/>
</p>

## Development

primo is built with and heavily inspired by [Svelte](https://svelte.dev/) - arguably the simplest, fastest, and most out-of-the-box-powerful frontend framework in existence. It's basically HTML+JavaScript with superpowers. If you've never used Svelte before but you're interested in trying, you'll find that it's incredibly easy to [learn](https://svelte.dev/tutorial/basics) (even for junior developers).

### Extending

Besides making it way easier for developers to build websites, primo's foundational goal is to make the IDE itself easy to extend. At the moment, only the field types are extendible, but API development is ongoing to make it easy to add new languages (e.g. SCSS, Pug, WASM), component types (e.g. Svelte, React, Vue), and CMS plugins. 

### Maintaining

Maintenance-wise, primo could use all the help it can get. There are integration tests but no unit tests, TypeScript is only used in a few of the components, and there are still some artifacts from the many refactors the project has gone through that need to be cleaned up. On the bright side, that means that anyone can jump in and start helping out. Yes, especially you.

Whether you're a junior or senior developer, writer, or just a web development enthusiast, if you want to make it easier for anyone to make websites, you're more than welcome to join the team.

### Running primo locally

This repo is for the core primo editor used by [primo-desktop](https://github.com/primo-app/primo-desktop) and [primo cloud](https://primocloud.io) (and by the self-hosted version of primo in the future). If you want to run primo locally for development:

1. `git clone git@github.com:primo-app/primo.git`
2. `cd primo`
3. `npm install`
4. `npm run dev`
5. Go to [http://localhost:5000](http://localhost:5000)

### How you can help

* Migrate non-TS components to TS
* Write integration tests (w/ Cypress)
* Refactoring

If that's not enough to go off of or you get stuck somewhere, somebody in the [Discord](https://discord.gg/kPsAsq) will be happy to point you in the right direction.