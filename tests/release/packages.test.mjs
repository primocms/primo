import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyReleasePackages } from '../../release/ship/verify-release-packages.mjs'

const versions = { cli: '0.3.0', mcp: '0.1.11' }
const lockfile = { packages: {
	'node_modules/primo-cli': { version: versions.cli, integrity: 'sha512-qualified-cli' },
	'node_modules/primo-mcp': { version: versions.mcp, integrity: 'sha512-qualified-mcp' }
} }
const readMetadata = async (name, version) => ({ name, version, dist: { integrity: lockfile.packages[`node_modules/${name}`].integrity } })

test('coordinated release requires the exact qualified CLI and MCP on npm', async () => {
	const checked = []
	await verifyReleasePackages({ lockfile, versions, readMetadata: async (name, version) => {
		checked.push(`${name}@${version}`)
		return readMetadata(name, version)
	} })
	assert.deepEqual(checked, ['primo-cli@0.3.0', 'primo-mcp@0.1.11'])
})

test('missing packages, registry errors and substituted archives block release', async () => {
	for (const name of ['primo-cli', 'primo-mcp']) {
		for (const change of [{ version: '0.0.1' }, { name: 'other' }, { dist: { integrity: 'sha512-repacked' } }, { dist: {} }]) {
			await assert.rejects(verifyReleasePackages({ lockfile, versions, readMetadata: async (requested, version) => ({
				...await readMetadata(requested, version), ...(requested === name ? change : {})
			}) }), /differs from the qualified archive/)
		}
	}
	await assert.rejects(verifyReleasePackages({ lockfile, versions, readMetadata: async () => { throw new Error('HTTP 404') } }), /HTTP 404/)
	await assert.rejects(verifyReleasePackages({ lockfile, versions: { ...versions, cli: '0.4.0' }, readMetadata }), /identities differ/)
})
