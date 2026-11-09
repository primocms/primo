import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { localDevelopmentRelease } from '../../src/lib/agent-setup.js'

// The dashboard's setup instructions must resolve to the same packages used
// by qualification, including a CLI initially installed from a local archive.
export async function verifyReleasePackages({ lockfile, versions = localDevelopmentRelease, readMetadata = npmMetadata }) {
	for (const [name, version] of [['primo-cli', versions.cli], ['primo-mcp', versions.mcp]]) {
		const qualified = lockfile.packages?.[`node_modules/${name}`]
		if (qualified?.version !== version || !qualified.integrity?.startsWith('sha512-')) throw new Error(`${name}@${version}: setup and qualified package identities differ`)
		const published = await readMetadata(name, version)
		if (published.name !== name || published.version !== version || published.dist?.integrity !== qualified.integrity) {
			throw new Error(`${name}@${version}: public npm package differs from the qualified archive`)
		}
	}
}

async function npmMetadata(name, version) {
	const response = await fetch(`https://registry.npmjs.org/${name}/${version}`, { signal: AbortSignal.timeout(15_000) })
	if (!response.ok) throw new Error(`${name}@${version}: public npm package is unavailable (HTTP ${response.status})`)
	return response.json()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const lockfile = JSON.parse(await fs.readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'))
	await verifyReleasePackages({ lockfile })
	console.log('Public CLI and MCP match the qualified package versions and integrity.')
}
