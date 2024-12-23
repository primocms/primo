<p align="center">
  <a href="https://primocms.org#gh-dark-mode-only" target="_blank">
    <img src="https://raw.githubusercontent.com/primocms/primo/master/static/logo.svg" alt="Primo" width="200px">
  </a>
  <a href="https://primocms.org#gh-light-mode-only" target="_blank">
    <img src="https://raw.githubusercontent.com/primocms/primo/master/static/logo-light.svg" alt="Primo" width="200px">
  </a>
</p>

# Primo V3 Alpha

## ✨ V3 Features & Improvements

- Custom Page Types (i.e. Content Types)
- Dynamic content fields (i.e. 'Site Field', 'Page Field', 'Page' to update entity page content referenced on other pages)
- Design system editor
- 10x faster build times bc every page gets generated on update, instead of all at once. 
- Conditional fields (to show/hide fields based on preceding field values)
- CSS-library compatibility (bootstrap, tailwind, bulma, etc. all work reliably using a standard cdn link). 
- UI/UX improvements
  - Drag pages to reorder them in the page list
  - Drag repeater items to reorder them
  - Drag-and-drop functionality improved for adding blocks to page & now works on mobile.
  - Block editor organized into code & content (i.e. fields & entries), UI improved.
  - On-page editing significantly improved.

![](https://cdn.primo.page/557834e8-7996-46f6-9328-0b84887d3bf7/staging/Accessible_Wardrobe_That_Women.png)

![](https://cdn.primo.page/557834e8-7996-46f6-9328-0b84887d3bf7/staging/Open_Sans.png)

![](https://cdn.primo.page/557834e8-7996-46f6-9328-0b84887d3bf7/staging/Pasted_Graphic_2.png)

![](https://cdn.primo.page/557834e8-7996-46f6-9328-0b84887d3bf7/staging/Stitch_Group_for.png)

# Running Primo locally
Primo isn't *really* self-hostable, yet, since it depends on a handful of [freemium] services, but the goal is that in the future it'll be fully self-hosted by default (probably a Docker image). You run it by cloning it, setting environment variables to connect it to the various services, then hosting the application (i.e. pushing it to a repo and connecting the repo to a host). You can also strip out the service-dependent bits yourself. 

Ensure you have accounts for all these services: 
* Supabase
* Resend
* Cloudflare
* Vercel, Netlify, Cloudflare, or another modern host. 

Note: you'll need to set up your Supabase account first. Run the schema found in `primo_schema.sql` to set up your tables before continuing.


```bash
git clone https://github.com/primocms/primo.git
cd primo
npm install

# Rename the example environment file and add your credentials for Supabase, Cloudflare, and Resend
mv .env.example .env

npm run build 
npm run preview
```

### To host Primo
If you want to run a hosted version of Primo, all you need to do is deploy your repo and set your environment variables. You can deploy it on any webhost for zero dollars.

1. Create a new Supabase project, go to the SQL editor, add a new query and provision your project by copying the [**schema**](<https://raw.githubusercontent.com/mateomorris/primo/master/primo_schema.sql>) and pasting it into the editor.

1. Go to your web host and create a new project from your new repository, inputting your Supabase details (go to the API settings) as environment variables.

```bash
# Resend (transactional emails)
PRIVATE_RESEND_KEY=

# Cloudflare (site hosting)
PRIVATE_CLOUDFLARE_ZONE_ID=
PRIVATE_CLOUDFLARE_ACCOUNT_ID=
PRIVATE_R2_TOKEN=
PRIVATE_R2_ACCESS_KEY_ID=
PRIVATE_R2_SECRET_ACCESS_KEY=
PRIVATE_CLOUDFLARE_WORKER_NAME=
PRIVATE_CLOUDFLARE_WORKERS_API_TOKEN=
PRIVATE_CLOUDFLARE_HOSTNAMES_TOKEN=
PRIVATE_CLOUDFLARE_ZONE_TOKEN=
PRIVATE_CLOUDFLARE_SITES_BUCKET=

# Supabase (database & auth)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLIC_KEY=
PRIVATE_SUPABASE_PRIVATE_KEY=
```


## Things you can change/extend
- Design system
- Field types
- Hosting destination
- Authentication methods
- Extensions (soon)
