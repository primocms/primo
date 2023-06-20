# Getting Started

Primo depends on several [freemium] third-party services for easy hosting, authentication, database and storage, etc. Running your own Primo server is as easy as forking the [**Primo repo**](<https://github.com/primocms/primo>) and deploying it on a static host like Vercel or Netlify, which should only take a few minutes.

Third-party services (all can be signed into with Github):

- A modern web host like [**Vercel**](<https://vercel.com/>) or [**Netlify**](<https://netlify.com>) to host the Primo application & published sites.

- A [**Supabase**](<https://supabase.com>) account to manage your server's authentication, database, and file storage.

- A [**Github**](<https://github.com>) account to deploy your sites to (unless you plan on downloading the site and connecting to a host).


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

6. The user account you create will be the server owner. You can manage the project's entire data from the Supabase project dashboard.

