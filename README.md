![screenshot](./screenshot.png)

# Primo
Primo is a component-based CMS that makes it easy to build visually-editable static sites. Its immense productivity advantage comes as a result of treating web pages as a collection of individual components (or sections) containing both content *and* code. And by embedding a development environment alongside the CMS, Primo enables site modifications to be made on the fly, and new components can be built, integrated, and used by content editors in fraction of the time compared to other approaches. Primo also gives content editors an ideal page building/content management experience designed entirely around arranging sections on the page and updating component content or writing copy directly on the page. And when you publish and update your site, Primo deploys it as a static site to a static host like Vercel or Netlify. 

## Features
- radically **simpler content editing** - focused fields for components, content & on-page editing for editorial content
- a powerful **component-editor** which you can use to modify any component on your site, applying updates to all instances of that component across your site
- a **component library** for managing the  components used on a site (including importing components from other primo sites or building new ones from scratch)
- **component packs** and templates built with clean, editable code. 
- **static site generation** which builds and uploads minimal HTML, CSS, and framework-less JavaScript files to your connected host. 
- **static host and Github integration** which creates a new Vercel/Netlify sites and Github repos for new primo sites, and updates them when you publish updates to your site. 

## Tech
Most of Primo's functionality and productivity advantages are due to Svelte - a compiler and UI language that extends HTML/CSS/JS's functionality to enable templating, style encapsulation, component-driven development, complex interactions and app-like functionality. primo pages are made of Svelte components and doc-like content sections (written with [TipTap](https://tiptap.dev/)), and the Svelte compiler turns those pages into clean HTML, CSS, and vanilla JavaScript that it uploads to a web host or Github repo. 

## How to get started
It's incredibly easy to build a site with Primo. Technically, you don't even have to write any code (though it's highly encouraged). To get started, download the desktop application from [primo.so](https://primo.so).

To build from your browser, invite collaborators, and upload images, check out [Primo Server](https://github.com/primodotso/primo-server).
