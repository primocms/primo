![screenshot](./screenshot.png)

# Primo
Primo is an all-in-one CMS. Unlike most (all?) CMSs, Primo is designed *both* for content editors (i.e. content) and developers (i.e. code) - offering a much more productive and enjoyable experience to both. Developers can create new sites instantly, modify their site one [Svelte](https://svelte.dev) component at a time, quickly create tailored content management experiences for non-technical content editors, and much more. Content editing in Primo is also done one component at a time as well as directly on the page for editorial content.

Instead of prioritizing one over the other, Primo treats code and content as two sides of the same coin since web components are made of both. And since web developers have to work with both when building websites, separating them means constantly context switching - setting up the component's content fields in the CMS, then switching to the IDE to write the component's code, then connecting the two (easier said than done). Primo puts the least amount of distance you can put between the two as possible by integrating them, enabling web developers to build faster and do more, and giving content editors a way to easily arrange pages and update content. 

But putting the code and content together enables the even greater benefit of **component-driven development**. Instead of modifying your components from files, you edit them right from Primo's Component Editor, and when you save your changes they get applied to every instance of that component on your site. On top of that, Primo comes with a library of pre-built components written with simple, clean code that adapt to your site's design using CSS custom properties. When publish and update your site, Primo deploys its as a static site to a static host like Vercel or Netlify. 

## Features
- radically **simpler content editing** - focused fields for components content & on-page editing for editorial content
- a powerful **component-editor** which you can use to modify any component in your site, applying updates to all instances of that component across your site
- a **component library** for managing the  components used on a site (including importing components from other primo sites or building new ones from scratch)
- **components packs** and templates built with clean, editable code. 
- **static site generation** which builds and uploads minimal HTML, CSS, and framework-less JavaScript files to your connected host. 
- **static host and Github integration** which creates a new Vercel/Netlify sites and Github repos for new primo sites, and updates them when you publish updates to your site. 

## Tech
Most of Primo's functionality and productivity advantages are due to Svelte - a compiler and UI language that extends HTML/CSS/JS's functionality to enable templating, style encapsulation, component-driven development, complex interactions and app-like functionality. primo pages are made of Svelte components and doc-like content sections (written with [TipTap](https://tiptap.dev/)), and the Svelte compiler turns those pages into clean HTML, CSS, and vanilla JavaScript that is fast-loading, secure by default, search engine optimized, and scalable. 

## How to get started
It's incredibly easy to build a site with Primo. Technically, you don't even have to write any code (though it's highly encouraged). To get started, download the desktop application from [primo.so](https://primo.so).

To build from your browser, invite collaborators, and upload images, try [Primo Server](https://github.com/primodotso/primo-server).
