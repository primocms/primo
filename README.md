# primo

primo is an *all-in-one* CMS. Compared to most CMSs that make it easier to manage content and host websites, primo makes it easier to manage content, edit code, curate components, and publish to a static host (Vercel, Netlify) or push to Github. 

It does this by integrating tools to solve a lot of the concerns you would normally need to figure out yourself when building a website with a CMS, like custom development, pre-built components, a UI framework, git integration, publishing and setup to put it all together for each new site. 

Having everything integrated out of the box means that new sites can be started without *any* setup, hundreds of sites can be managed on the same server (or Desktop app), final website code stays as lean as possible, all components can be seamlessly used across sites and adapt to the design of that site (using CSS variables), and a lot more. 

Most of primo's functionality and productivity advantages are due to Svelte - compiler and UI language that extends HTML/CSS/JS's functionality to enable templating, style encapsulation, component-driven development, complex interactions and app-like functionality. primo pages are made of Svelte components and WYSIWYG content sections (written with [TipTap](https://tiptap.dev/)), and the Svelte compiler turns those pages into clean HTML, CSS, and vanilla JavaScript that is fast-loading, secure by default, search engine optimized, and scalable. 

## Features
- a powerful **code-editor** which you can use to modify any component in your site, applying the updates to all instances of that component across your site
- a **component library** for managing the  components used on a site (including importing components from other primo sites or building new ones from scratch)
- **components packs** and themes built with clean, editable code. 
- **static site generation** which builds and uploads minimal HTML, CSS, and framework-less JavaScript files to your connected host. 
- **static host and Github integration** which creates a new Vercel/Netlify sites and Github repos for new primo sites, and updates them when you publish updates to your site. 

## How to get started
It's incredibly easy to build a site with Primo. Technically, you don't even have to write any code (though it's highly encouraged). To get started, download the desktop application from [primo.af](https://primo.so).

To build from your browser, invite collaborators, and upload images, try [Primo Server](https://github.com/primo-af/primo/tree/master/server).
