<script>
	import { flattenDeep, uniqBy } from 'lodash-es';
	import JSZip from 'jszip';
	import { saveAs } from 'file-saver';
	import { html as beautifyHTML } from 'js-beautify';
	import { site, modal } from '@primo-app/primo';
	import { buildStaticPage } from '@primo-app/primo/src/stores/helpers';
	import ModalHeader from '@primo-app/primo/src/views/modal/ModalHeader.svelte';
	import { page } from '$app/stores';
	import Button from '@primo-app/primo/src/components/buttons/PrimaryButton.svelte';

	const siteID = $page.params.site;

	let loading = false;

	async function downloadSite() {
		loading = true;
		const zip = new JSZip();
		const files = await buildSiteBundle($site, siteID);
		files.forEach((file) => {
			zip.file(file.path, file.content);
		});
		const toDownload = await zip.generateAsync({ type: 'blob' });
		saveAs(toDownload, `primo-site.zip`);
		modal.hide();
	}

	async function buildSiteBundle(site, siteName) {
		const primoPage = `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>

          <body class="primo-page">   
            <iframe allow="clipboard-read; clipboard-write self https://its.primo.af" border="0" src="https://its.primo.af/${siteName}" style="height:100vh;width:100vw;position:absolute;top:0;left:0;border:0;"></iframe>
          </body>
        </html>
      `;

		const pages = await Promise.all([
			...site.pages.map((page) => buildPageTree({ page, site })),
			{
				path: `primo.json`,
				content: JSON.stringify(site)
			}
			// [
			//   {
			//     path: `primo/index.html`,
			//     content: primoPage,
			//   },
			//   // {
			//   //   path: 'robots.txt',
			//   //   content: `
			//   //   # Example 3: Block all but AdsBot crawlers
			//   //   User-agent: *
			//   //   Disallow: /`
			//   // },
			// ],
		]);

		return buildSiteTree(pages, site);

		async function buildPageTree({ page, site, isChild = false }) {
			const { id } = page;
			const { html, modules } = await buildStaticPage({
				page,
				site,
				separateModules: true
			});
			const formattedHTML = await beautifyHTML(html);

			return await Promise.all([
				{
					path: `${id === 'index' ? `index.html` : `${id}/index.html`}`,
					content: formattedHTML
				},
				...modules.map((module) => ({
					path: `_modules/${module.symbol}.js`,
					content: module.content
				})),
				...(page.pages
					? page.pages.map((subpage) => buildPageTree({ page: subpage, site, isChild: true }))
					: [])
			]);
		}

		async function buildSiteTree(pages, site) {
			const json = JSON.stringify(site);

			return [
				...flattenDeep(pages)
				// {
				//   path: `styles.css`,
				//   content: styles
				// },
				// {
				//   path: `primo.json`,
				//   content: json,
				// },
				// {
				//   path: 'README.md',
				//   content: `# Built with [primo](https://primo.af)`,
				// },
			];
		}
	}

	let pages = [];
</script>

<ModalHeader icon="fas fa-globe" title="Publish" variants="mb-4" />

<main class="primo-reset">
	<div class="content">
		If you download Primo, you'll be able to publish your site updates directly to your favorite web
		host (assuming your favorite web host is Vercel). You can download it at <a
			href="https://primo.af"
			target="blank"
			class="link">primo.af</a
		>.
	</div>
	<div class="publish">
		<Button on:click={downloadSite}>Download your site</Button>
	</div>
</main>

<style lang="postcss">
	.title {
		margin-bottom: 0.5rem;
		color: var(--color-gray-1);
		font-weight: 600;
		transition: color 0.1s;
		a {
			text-decoration: underline;
		}
	}

	.link {
		text-decoration: underline;
	}

	.subtitle {
		color: var(--color-gray-2);
		margin-bottom: 1rem;
		font-size: var(--font-size-2);
		line-height: 1.5;
	}

	.content {
		padding: 2rem 0;
		max-width: 600px;
		margin: 0 auto;
	}

	main {
		background: var(--primo-color-black);
		color: var(--color-gray-1);
		padding: 1rem;
		padding-bottom: 3rem;

		.publish {
			display: grid;
			gap: 1rem;
			place-items: flex-start normal;
			max-width: 600px;
			margin: 0 auto;

			.boxes {
				margin-bottom: 1rem;
			}

			.box {
				padding: 1rem;
				background: var(--color-gray-9);
				color: var(--color-gray-2);
				display: flex;
				flex-direction: column;

				&:not(:last-child) {
					border-bottom: 1px solid var(--color-gray-8);
				}

				.deployment {
					padding: 0.5rem 0;
					display: flex;
					flex-direction: column;

					a {
						text-decoration: underline;
						transition: color 0.1s;
						&:hover {
							color: var(--color-primored);
						}
					}

					&:not(:last-child) {
						border-bottom: 1px solid var(--color-gray-8);
					}
				}
			}
		}
	}

	@media (max-width: 600px) {
		main {
			.publish {
				grid-template-columns: auto;
			}
		}
	}
</style>
