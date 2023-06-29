# Publishing Primo Sites

To publish, you need to either download your site & host it manually, or enter your Github Token to publish to Github - this is the recommended option. Primo will create a new repository under your account or you can deploy to an existing repository.

Once you've deployed to your repository, you can publish your site to any modern web host & auto-deploy it when you publish updates to the repository from Primo.

## Connecting to Github
1. Go to [Github settings > Generate new token](<https://github.com/settings/tokens/new>).
1. Give your token a name, select an expiration date (ideally 'No expiration') and **select the repo** permission.
![Select repo option](https://github.com/primocms/docs/blob/main/assets/connect_to_github_1.png?raw=true)
1. Copy + paste the generated token token into Primo & click 'Connect'.
![Select repo option](https://github.com/primocms/docs/blob/main/assets/connect_to_github_2.png?raw=true)
![Select repo option](https://github.com/primocms/docs/blob/main/assets/connect_to_github_3.png?raw=true)
1. Once you're connected, you can choose to either deploy to an existing repo or create a new one.
![Select repo option](https://github.com/primocms/docs/blob/main/assets/connect_to_github_4.png?raw=true)


## Deploying to a web host
The easiest way to get your Primo sites online is to deploy them to a Github repository, then sign up for a modern web host like [Vercel](<https://vercel.com>), [Netlify](<https://netlify.com>), or [Render](<https://render.com>) to publish your Github repository to the web. When you deploy changes to the repo from Primo, they'll be auto-published to the host without needing to set up additional CI/CD. Below, you can find specific instructions for each host.

### Deploying to [Vercel](<https://vercel.com>)
Vercel is the recommended web host since it offers the most straightforward path to get your sites online.

1. Create a new project
1. Choose your Primo site's repo as the source
1. Click 'Deploy'

![Vercel](https://github.com/primocms/docs/blob/main/assets/vercel_deployed.png?raw=true)

### Deploying to [Netlify](<https://netlify.com>)
1. Under 'Sites', select 'Import from Git'
1. Click 'Deploy with Github'
1. Choose your Primo site's repo as the source
1. Click 'Deploy demotest'

![Netlify](https://github.com/primocms/docs/blob/main/assets/netlify_deployed.png?raw=true)

### Deploying to [Render](<https://render.com>)
1. From the dashboard, click 'New Static Site'
2. Choose your Primo site's repo as the source
3. For "Publish Directory", type "`./`"
4. Click 'Create Static Site'

![Render](https://github.com/primocms/docs/blob/main/assets/render_deployed.png?raw=true)

### Deploying to [Github Pages](<https://pages.github.com/>)

> ⚠️ Github Pages isn't recommended as a host due to conflicts with publishing to subdomains (e.g. `mateomorris.github.io/blog`). All of the hosts listed above also have free personal plans, can be signed into with your Github account, and can be spun up just as quickly.

1. Ensure your site's deployed repo is named "`yourgithubusername.github.io`"
1. After a moment, your site should be published to "`yourgithubusername.github.io`"

![GH Pages](https://github.com/primocms/docs/blob/main/assets/gh_pages.png?raw=true)