import { readFileSync } from 'node:fs'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const REPO_ROOT = path.join(process.env.RC_INSTALL, 'node_modules/primo-cli')
const package_json = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
export const CLI_ENTRY = path.join(REPO_ROOT, package_json.bin.primo)

/**
 * Runs the BUILT CLI the way a user does — `node <package bin> ...` — rather
 * than importing src/. Testing the build output is the point: it's what npm
 * publishes, and it's what has shipped broken before.
 *
 * HOME is redirected to a throwaway dir because utils/auth.ts resolves its
 * token store from os.homedir(). Without this, a test run would read (and
 * `primo login` would overwrite) the real ~/.primo/tokens.json.
 */
export function run_cli(args, { cwd, home, env = {}, timeout_ms = 30000 } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
			cwd,
			env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1', ...env }
		})

		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (chunk) => (stdout += chunk))
		child.stderr.on('data', (chunk) => (stderr += chunk))

		const timer = setTimeout(() => {
			child.kill('SIGKILL')
			reject(new Error(`CLI timed out after ${timeout_ms}ms: primo ${args.join(' ')}\n${stdout}\n${stderr}`))
		}, timeout_ms)

		child.on('error', (error) => {
			clearTimeout(timer)
			reject(error)
		})
		child.on('close', (code) => {
			clearTimeout(timer)
			resolve({ code, stdout, stderr, output: `${stdout}${stderr}` })
		})
	})
}

/** Disposable working dir + fake HOME, so nothing touches the real one. */
export async function make_workspace() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-cli-smoke-'))
	const home = path.join(root, 'home')
	const work = path.join(root, 'work')
	await fs.mkdir(home, { recursive: true })
	await fs.mkdir(work, { recursive: true })
	return {
		root,
		home,
		work,
		/** Seeds the token store utils/auth.ts reads, for the authenticated paths. */
		async write_token(server, token) {
			await fs.mkdir(path.join(home, '.primo'), { recursive: true })
			await fs.writeFile(path.join(home, '.primo', 'tokens.json'), JSON.stringify({ [server.replace(/\/+$/, '').toLowerCase()]: token }))
		},
		cleanup: () => fs.rm(root, { recursive: true, force: true })
	}
}
