<p align="center">
  <img src="readme_assets/logo.svg" alt="logo"/>
</p>

<p align="center">
  <img src="readme_assets/comic.png" alt="comic"/>
</p>

# web development, finally simple

Developing and managing small custom websites is complicated. With primo, you develop and manage your site visually, right from your browser. That way you can skip the headache and just get down to business.
## Development

primo is built with and heavily inspired by [Svelte](https://svelte.dev/) - arguably the simplest, fastest, and most out-of-the-box-powerful frontend framework in existence. It's basically HTML+JavaScript with superpowers. If you've never used Svelte before but you're interested in trying, you'll find that it's incredibly easy to [learn](https://svelte.dev/tutorial/basics) (even for junior developers). 

### Extending

One of primo's foundational goals is to make the IDE itself easy to extend and build on. At the moment, only the field types are extendible, development is forthcoming (and contributons are welcome) to make it possible to add new component types (e.g. Svelte, React, Vue), plugins, themes, etc.. And since apps built with Svelte play well with apps built with any other JS framework, you should be able build on top of primo with your framework of choice. 

### Maintaining

Help with maintenance is always welcome, whether in the form of a suggestion or a PR. At the moment, the biggest pushes maintenance-wise are to integrate TypeScript into the rest of the project, to add enough tests, and to document the codebase to make onboarding easier. 

Whether you're a junior or senior developer, writer, or just a web development enthusiast, if you want to make it easier for anyone to make websites, you're more than welcome to join us over at the primo [Discord](https://discord.com/invite/UeNeTk6cF3).

### Running primo locally

If you want to run primo locally (for development or testing):

1. `git clone https://github.com/primo-app/primo.git`
2. `cd primo && npm install`
3. `npm run dev`
4. Open [http://localhost:5000](http://localhost:5000) in your browser

### How you can help

* Migrate non-TS components to TS
* Write integration tests (w/ Cypress)
* Refactoring
  