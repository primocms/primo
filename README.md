<p align="center">
  <a href="https://primocms.org#gh-dark-mode-only" target="_blank">
    <img src="https://raw.githubusercontent.com/primocms/primo/master/static/logo.svg" alt="Primo" width="200px">
  </a>
  <a href="https://primocms.org#gh-light-mode-only" target="_blank">
    <img src="https://raw.githubusercontent.com/primocms/primo/master/static/logo-light.svg" alt="Primo" width="200px">
  </a>
</p>

<h3 align="center">The modern monolithic CMS</h3>
<p align="center">Primo makes it a blast to build pages, update content, and edit code - one block at a time.</p>

<p align="center">
    <a href="https://primocms.org/">Primocms.org</a> •
    <a href="https://discord.com/invite/DMQshmek8m">Discord</a> •
    <a href="https://docs.primocms.org/">Docs</a> •
    <a href="https://primocms.org#section-b18b744b-92ba-4bf9-96fd-4d86c0a842b8">Newsletter</a> •
    <a href="https://www.youtube.com/@primocms">YouTube</a>
</p>

![screenshot](https://github.com/primocms/primo/raw/master/screenshot-v2.png)

## ⭐ Why Primo? 

Traditional monolithic CMSs like WordPress, Drupal, and Joomla enable quick setup and easy content editing, but rely on antiquated and heavy development practices (often relying on plugins and third-party services to customize the site and add new components). Headless CMSs have popped up to modernize the view layer with modern development practices and frameworks, but have a poorer content editing experience due to their decoupling from the content layer.

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
Primo depends on several [freemium] third-party services for easy hosting, authentication, database and storage, etc. Running your own Primo server is as easy as forking the [**Primo repo**](<https://github.com/primocms/primo>) and deploying it on a static host like Vercel or Netlify, which should only take a few minutes.

Third-party services (all can be signed into with Github):

- A modern web host like [**Vercel**](<https://vercel.com/>) or [**Netlify**](<https://netlify.com>) to host the Primo application & published sites.

- A [**Supabase**](<https://supabase.com>) account to manage your server's authentication, database, and file storage.

- A [**Github**](<https://github.com>) account to deploy your sites to (unless you plan on manually downloading/uploading your site files to a host).


<!-- -->

## Installation

1. Ensure you have an account with all the services listed above.

2. Create a new Supabase project, go to the SQL editor, add a new query and provision your project by copying the [**schema**](<https://raw.githubusercontent.com/mateomorris/primo/master/primo_schema.sql>) and pasting it into the editor.

3. Fork the [**Primo repository**](<https://github.com/primocms/primo>).

4. Go to your web host and create a new project from your new repository, inputting your Supabase details (go to the API settings) as environment variables.

    - PUBLIC\_SUPABASE\_URL

    - PUBLIC\_SUPABASE\_PUBLIC\_KEY

    - PRIVATE\_SUPABASE\_PRIVATE\_KEY

![Environment Variables](https://dbfnrqvkgwkjkzqgnfrd.supabase.co/storage/v1/object/public/images/Screenshot%202023-05-06%20at%206.45.43%20PM.png)


5. Publish the project and navigate to the Primo authentication screen.

6. The user account you create will be the server owner. You can manage all your server's data from the Supabase project dashboard.

7. Finally, go back to your Supabase project & set the Site URL to the URL of your Primo site (under Authentication > URL Configuration > Site URL).
<img width="750" alt="Screenshot 2023-07-11 at 12 44 26 PM" src="https://github.com/primocms/primo/assets/39444813/aff51c73-3935-4523-bf89-71f86f3f8f09">


For more details see this step-by-step installation [video guide](<https://www.youtube.com/watch?v=LEcKmhJsUzo>)

## Updating
You can merge upstream updates by clicking 'Sync fork' on your forked repository. Your updates will automatically deploy to your web host.
