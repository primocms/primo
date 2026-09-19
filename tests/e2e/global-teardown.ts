import fs from 'fs'

const PID_FILE = '/tmp/primo-e2e-server.pid'

export default async function globalTeardown() {
	if (!fs.existsSync(PID_FILE)) return
	const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
	try {
		process.kill(pid, 'SIGTERM')
	} catch {
		// already gone
	}
	fs.rmSync(PID_FILE, { force: true })
}
