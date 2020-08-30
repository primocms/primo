<p align="center">
  <img src="logo.svg" alt="primo logo"/>
</p>

![demo](demo.gif)

# primo is a visual, integrated, delightful code editor and content management system

primo is built with and heavily inspired by [Svelte](https://svelte.dev/) - arguably the simplest, fastest, and most out-of-the-box-powerful frontend framework in existence. The best way I can describe it is HTML+JavaScript with superpowers. If you've never used Svelte before but you're interested in trying, I think you'll find that it's incredibly easy to [learn](https://svelte.dev/tutorial/basics).

Code-wise, primo isn't at all in an ideal place at the moment. In particular, there's little to no test coverage, TypeScript is only used in a fraction of the components, and there are still some artifacts from the many refactors the project has gone through that need to be cleaned up. But on the bright side, that means that anyone can jump in and start helping out. Yes, especially you.

Whether you're a seasoned or unseasoned developer, if you want to help make it easier to make websites, you're more than welcome to [help out](https://opensource.guide/how-to-contribute/#how-to-submit-a-contribution).

## Running primo locally

* nothing will happen if you download this repo and try building it *. This repo is for the core primo editor, it gets used by [primo-desktop](https://primo.af) and [primo cloud](https://primocloud.io) (and by the self-hosted version of primo in the future). If you want to run primo locally to tinker with it:

1. Fork and clone `primo-desktop`
2. Fork and clone this repo into the same directory
3. Run `npm link` in `primo`
4. Run `npm link primo-app` in `primo-desktop` (this makes it so any changes in `primo-app` rebuild `primo-desktop`)
5. Follow directions in `primo-desktop`'s readme to build for development

## Not sure how to contribute? Start here

* Migrate to TypeScript
* Write integration tests (w/ Cypress)
* Docs, docs, docs
