# primo

primo is an all-in-one app for building and managing static sites with Svelte.

![screenshot](./screenshot.png)

## How to use primo

### [primo Desktop](https://github.com/primo-af/primo-desktop)
Create and manage sites locally & offline. Sites can be downloaded or deployed directly to available hosts. Each site is stored as a small JSON file in your directory of choice. 
* [Download for Mac](https://github.com/primo-af/primo-desktop/releases/download/v0.1.1/primo-darwin-x64-1.0.0.zip)
* [Download for Windows](https://github.com/primo-af/primo-desktop/releases/download/v0.1.0-alpha-windows/primo.exe)

### [primo Server](https://github.com/primo-af/primo-server)
Create and manage sites from any device/browser & invite collaborators for individual sites. Can be deployed to Vercel with a Supabase backend in a few minutes.
* [Deploy with Vercel & Supabase](https://github.com/primo-af/primo-server#setup)

## How it compares

WordPress and proprietary site builders (Wix, Webflow, etc.) let you manage your content relatively easily, but make modifying your site’s source code a lot harder than just working directly with HTML files.

NextJS, Gatsby, Hugo, etc give you direct control over your site and enable more powerful functionality, but typically require a lot of upfront work and don't include a content management layer (unless you're cool with .MD files). 

Primo bridges these two sides by providing a built-in CMS for content management, a built-in IDE for development (using Svelte), and hosting integrations to make deploying site updates a breeze. It also includes a growing library of pre-built & fully integrated components so you can publish a freaky fast, easily-editable website in literal minutes. 

## Project Status

Primo is currently in public Alpha. The early version of it was only available as a [free] service, but once we realized what a bad idea it was to be responsible for thousands of free websites, we dropped the service to focus on building desktop & self-hosted server versions of primo. We would recommend waiting until the Beta to use Primo in production, but for now it should be stable enough for personal projects. 

## Contributing

The best way to contribute at the moment is by using the app and staying in close contact with us (on Discord, Github Discussions, or Email) on how it's working (including bugs, deficiencies, and advantages). Feel free to file bugs as issues and start a Discussion to bring up new ideas. 

At the moment, this is just where the core primo editor lives, so it won't run on its own. To run the primo in development, see [primo Desktop](https://github.com/primo-af/primo-desktop). 
