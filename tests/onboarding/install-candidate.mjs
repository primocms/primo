// The deterministic agent driver installs an exact official release asset using
// separate arguments. The test delivery fixture supplies the unpublished bytes.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const [release, destination, name, expectedURL] = process.argv.slice(2)
const response = await fetch(release)
assert.ok(response.ok)
const metadata = await response.json()
assert.equal(metadata.tag_name, 'v3.3.2-rc.13')
const asset = metadata.assets.find((asset) => asset.name === name)
assert.equal(asset.browser_download_url, expectedURL)
const download = await fetch(asset.browser_download_url)
assert.ok(download.ok)
await fs.mkdir(path.dirname(destination), { recursive: true })
await fs.writeFile(destination, Buffer.from(await download.arrayBuffer()), { mode: 0o755 })
