import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [server, siteId, siteDirectory] = process.argv.slice(2)
const token = process.env.PRIMO_TOKEN
if (!server || !siteId || !siteDirectory || !token) {
	console.error('Usage: PRIMO_TOKEN=<token> node install.mjs <server-url> <site-id> <site-directory>')
	process.exit(1)
}
const serverURL = new URL(server)
if (!['http:', 'https:'].includes(serverURL.protocol) || serverURL.username || serverURL.password || serverURL.pathname !== '/') {
	throw new Error('Use a server origin, such as https://cms.example.com')
}
if (serverURL.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(serverURL.hostname)) {
	throw new Error('Use HTTPS when sending an admin token to a remote server')
}
const definition = JSON.parse(await readFile(new URL('./form.json', import.meta.url), 'utf8'))
// Write into a new directory only. Never overwrite a customized block.
const directory = resolve(siteDirectory, 'blocks/contact_form')
await mkdir(directory, { recursive: false })
// Install the plugin (server-validated against plugins/forms/manifest.json)
// before registering any form. `data` is always granted; `email` is granted
// so notifyTo works if the site owner sets it later — see README's
// "Capabilities" section. Idempotent: safe to re-run.
const installResponse = await fetch(`${serverURL.origin}/api/primo/sites/${encodeURIComponent(siteId)}/plugins/forms`, {
	method: 'PUT',
	redirect: 'error',
	headers: { Authorization: token, 'Content-Type': 'application/json' },
	body: JSON.stringify({ grant: { email: true } })
})
if (!installResponse.ok) throw new Error(`Plugin install failed (${installResponse.status}): ${await installResponse.text()}`)
const response = await fetch(`${serverURL.origin}/api/primo/sites/${encodeURIComponent(siteId)}/forms/contact`, {
	method: 'PUT',
	redirect: 'error',
	headers: { Authorization: token, 'Content-Type': 'application/json' },
	body: JSON.stringify(definition)
})
if (!response.ok) throw new Error(`Form registration failed (${response.status}): ${await response.text()}. The empty block directory can be removed before retrying.`)
for (const file of ['component.svelte', 'config.yaml', 'fields.yaml']) {
	await writeFile(resolve(directory, file), await readFile(new URL(`./blocks/contact_form/${file}`, import.meta.url)), { flag: 'wx' })
}
await writeFile(resolve(directory, 'content.yaml'), `title: Get in touch\nsite_id: ${JSON.stringify(siteId)}\nserver_url: ""\n`, { flag: 'wx' })
console.log(`Registered contact form and wrote ${directory}. Add contact_form to a page and push/publish the site.`)
console.log(`Inbox: ${serverURL.origin}/admin/forms?site=${encodeURIComponent(siteId)}`)
