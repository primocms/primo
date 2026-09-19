import { spawn } from 'child_process'
import fs from 'fs'
import { PRIMO_BINARY, TEST_DATA_DIR, SERVER_LOG, TEST_HTTP_ADDR, TEST_SERVER_URL } from './helpers/paths'

const PID_FILE = '/tmp/primo-e2e-server.pid'

async function waitForServer(url: string, timeoutMs = 20000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url)
			if (res.status < 500) return
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 200))
	}
	throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`)
}

// Starts one isolated PocketBase+Primo server shared by all spec files in
// this run. Each spec file seeds its own fixture site (see
// helpers/seed.ts's seedFixtureSite) rather than sharing a single global
// site, so specs don't interfere with each other's content even though
// they share this one server process.
export default async function globalSetup() {
	// Fresh isolated data dir — never touches the real dev pb_data.
	if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
	fs.mkdirSync(TEST_DATA_DIR, { recursive: true })

	const serverLog = fs.openSync(SERVER_LOG, 'w')
	const child = spawn(PRIMO_BINARY, ['serve', `--http=${TEST_HTTP_ADDR}`, `--dir=${TEST_DATA_DIR}`], {
		env: { ...process.env, PRIMO_DEV_MODE: '1' },
		stdio: ['ignore', serverLog, serverLog],
		detached: true
	})
	fs.writeFileSync(PID_FILE, String(child.pid))
	child.unref()

	await waitForServer(TEST_SERVER_URL)
}
