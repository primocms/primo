# Primo Server

This project lets you run Primo on your own server so you have full control over your own data and can edit your sites from any device, as well as invite others to collaborate. 

If you're just building websites for yourself, you may prefer just using Primo Desktop. But this project allows you to run Primo in the cloud so that you can access and edit your sites from any device and collaborate with other developers/content editors (not at the same time), as well as edit them from Primo Desktop. 

### Features
* Multiple users
* Image uploads
* Use from anywhere

## Project Status

Primo Server is in Alpha. Features may break from version to version, but _probably_ not enough to delete all your data or anything drastic. 

Until we ge to Beta, we can't recommend using primo in production (but it's good enough for personal projects).

## How it works
This repo deploys primo to [Vercel](https://vercel.com) and uses [Supabase](https://supabase.co) for authentication, database (PostgreSQL), and storage. 

## Setup 
Primo can be run on the free tier of both services (Vercel & Supabase), but you'll need to sign in with Github. 

Before deploying your Primo Server, you'll need to sign up for [Supabase](https://supabase.co) and create a new project. 

### 1. Deploy Backend (Supabase)
1. Create a [Supabase](https://supabase.co) account or sign in with Github
1. Create a new project
1. When it's ready, select 'SQL' from the sidebar navigation
1. Click **+ New query** 
1. Paste in the contents of [`./primo_schema.sql`](https://raw.githubusercontent.com/primo-af/primo-server/master/primo_schema.sql) and click 'RUN' 
1. Disable Email confirmations (Authentication > Settings > Email Auth)


### 2. Deploy Frontend (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fprimo-af%2Fprimo%2Ftree%2Fmaster%2Fserver&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLIC_KEY,VITE_SUPABASE_ADMIN_KEY&envDescription=Supabase%20is%20an%20open-source%20Backend%20as%20a%20Service%20which%20Primo%20Server%20uses%20for%20Authentication%2C%20Database%2C%20and%20Storage.%20&demo-title=Primo%20Server&demo-description=Primo%20is%20a%20simpler%2C%20all-in-one%20way%20to%20build%20and%20manage%20websites.&demo-url=https%3A%2F%2Fprimo.af&demo-image=https%3A%2F%2Fres.cloudinary.com%2Fprimoaf%2Fimage%2Fupload%2Fv1635078478%2FScreen-Shot-2021-10-24-at-2.24.17-PM_1_eagd0z.webp)

1. Click this nice button and follow the prompts. 
1. Under 'Configure Project', enter your Supabase project **URL**, **Public Key (anon public)**, and **Admin Key (service_role secret)** (which you can find in the Supabase project dashboard > Settings > API https://app.supabase.io/project/---yourprojectid---/settings/api)
1. Click 'Deploy'
1. Sign up with an email address and password (this will be the admin account). The server has a single email/password account which can invite server collaborators. 

### Updating

At the moment, the only way to update your server instance to a newer version of primo is to re-deploy it. It takes a few steps, but doesn't require migrating your database or anything dangerous like that. 

1. Delete the existing repository and Vercel project (the data will be unaffected since it's in Supabase)
1. Click 'Deploy' and follow the instillation steps, using your existing Supabase project's details

## Contributing
Feel free to look for open issues in this repo and the [primo repo](https://github.com/primo-af/primo). If you find a bug or find yourself needing something from primo that it can't do, please open an issue to start discussion. 

If you have any ideas or time to contribute, feel free to open an issue or come talk to us in the [primo Discord](https://discord.gg/vzSFTS9). 
