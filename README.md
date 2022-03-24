# Primo

<img width="1440" alt="image" src="https://user-images.githubusercontent.com/39444813/159909586-8ea31e64-cbd0-4421-8e19-9d2868d71427.png">


Primo is an all-in-one static site builder, combining a:
* Content Mangement System
* Development Environment
* Static Site Generator
* Component Library


into a single application, making it dead simple to develop, manage, and publish high-performing websites. 

## Why Primo
Traditional site-builders like Wix and Squarespace make content management easier, but at the expense of the customization, functionality, and site performance expected by Developers. Modern frontend frameworks give developers superpowers, but at the expense of increased setup time and poor content management. Primo combines the quick setup and easy content management of a site builder with the performance and freedom of a framework, making it possible for developers of any level and background to publish fast-loading, mobile-optimized, customizable websites. 

## How it works

Primo's an all-in-one application - combining a development environment with an internationalized content management system with a component library with a static site generator that publishes directly to your favorite web host*. Primo pages are built one section at a time, and sections can contain either WISIWYG content written directly on the page or components. Primo gives you a set of components to use out of the box - you can use them as-is or edit their code directly from Primo. Although Primo components appear on the surface to be written with basic HTML, CSS, and JavaScript, they're actually written in [Svelte](https://svelte.dev): a compiled language which builds on the fundamental web languages while enabling templating, style encapsulation, and reactivity, among other things. Component fields can be added from the component editor and integrated with Svelte's templating tags (e.g. if you add a field and give it an ID of `heading`, you can make it an editable field in the CMS by adding it to your component's code like so - `<h1>{heading}</h1>`.) To publish the site, a web host can be connected using an API token, and after a click Primo creates and uploads the site bundle to your chosen host. Each page of the site is made of static HTML and CSS, and any necessary JS gets downloaded as a module after the page loads and hydrates its respective component. 

*assuming your favorite web host is Vercel or Netlify. Otherwise, you can download the site bundle to host it elsewhere. 

## How to get started

It's incredibly easy to build a site with Primo. Technically, you don't even have to write any code (thanks to the on-page editing and build-in components). To get started, download the desktop application from [primo.af](https://primo.af).

To build from the browser, invite collaborators, and upload images, try [Primo Server](https://github.com/primo-af/primo/tree/master/server).
