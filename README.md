&nbsp;
<p align="center">
  <a href="https://primocms.org" target="_blank">
    <img src="./static/logo.svg" alt="Primo" width="200px">
  </a>
</p>

<h3 align="center">The modern monolithic CMS</h3>
<p align="center">Primo makes it a blast to build pages, update content, and edit code - one block at a time.</p>

<p align="center">
    <a href="https://primocms.org/">Primocms.org</a> •
    <a href="https://forum.primo.so">Forum</a> •
    <a href="https://docs.primocms.org/">Docs</a> •
    <a href="https://primocms.org#section-b18b744b-92ba-4bf9-96fd-4d86c0a842b8">Newsletter</a> •
    <a href="https://www.youtube.com/@primocms">YouTube</a>
</p>

![screenshot](/screenshot-v2.png)

## ⭐ Why Primo? 

Traditional monolithic CMSs like WordPress, Drupal, and Joomla enable quick setup and easy content editing, but rely on antiquated and heavy development practices (often relying on plugins and third-party services to customize the site and add new components). Headless CMSs have popped up to modernize the view layer with modern development practices and frameworks, but have a poorer content editing experience due to their full separation from the site's presentation.

Primo is a modern approach to the monolithic CMS that builds on the traditional monolith's benefits of a quick setup and easy content editing alongside the benefits of modern development (i.e. Svelte). These combine into a web publishing tool that is significantly easier and more fun to use for both technical and non-technical users and enables you to build faster, more secure, and more unique websites.

## ✨ Features

- Visual, on-page content editing
- Drag-and-drop page building with blocks
- Integrated development environment for blocks and pages
- Static site generation
- Real-time page collaboration
- Internationalization
- Multisite (1 server = infinity sites)
- Deploys to Github (i.e. any web host)

[Read more in the Docs](https://docs.primocms.org)

# How to self-host Primo

Primo depends on several [freemium] third-party services for easy hosting, authentication, database and storage, etc. Running your own Primo server is as easy as forking the Primo repo and deploying it on a static host like Vercel or Netlify, which should only take a few minutes.

Third-party services (all can be signed into with Github):

- A modern web host like Vercel or Netlify to host the Primo application & published sites.

- A Supabase account to manage your server's authentication, database, and file storage.

- A Github account to deploy your sites to (unless you plan on downloading the site and connecting to a host).

## Installation
Ensure you have an account with all the services listed above.

Create a new Supabase project, go to the SQL editor, add a new query and provision your project by copying the schema and pasting it into the editor.

Fork the Primo repository.

Go to your web host and create a new project from your new repository, inputting your Supabase details (go to the API settings) as environment variables.

- PUBLIC_SUPABASE_URL

- PUBLIC_SUPABASE_PUBLIC_KEY

- PRIVATE_SUPABASE_PRIVATE_KEY

- Environment Variables

Publish the project and navigate to the Primo authentication screen.

The user account you create will be the server owner. You can manage the project's entire data from the Supabase project dashboard.

## Updating
You can merge upstream updates by clicking 'Sync fork' on your forked repository. Your updates will automatically deploy to your web host.
