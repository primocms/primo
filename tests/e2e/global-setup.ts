import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { PRIMO_BINARY, PRIMOCMS_ROOT, CLI_ENTRY, TEST_DATA_DIR, SERVER_LOG, TEST_HTTP_ADDR, TEST_SERVER_URL } from './helpers/paths'

const PID_FILE = '/tmp/primo-e2e-server.pid'
const FRONTEND_BUILD_DIR = path.join(PRIMOCMS_ROOT, 'internal/build')
const COMMON_BUNDLE = path.join(PRIMOCMS_ROOT, 'internal/common/index.cjs')

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

// Paths (relative to PRIMOCMS_ROOT) that actually feed the frontend build
// and/or the Go binary — deliberately excludes tests/, docs, and other
// tracked files whose changes have no effect on `primo`'s build output, so
// editing a spec file doesn't spuriously flag the binary as stale.
const BUILD_INPUT_PATHS = ['src', 'internal', 'static', 'migrations', 'go.mod', 'go.sum', 'main.go', 'package.json', 'package-lock.json']
// Generated build output lives inside internal/ but must not count as an
// input to itself.
const BUILD_OUTPUT_EXCLUDES = ['internal/build/', 'internal/common/index.cjs']

/** Newest mtime among tracked files that affect the build, so we can tell
 * whether a build artifact predates the source it's supposed to be built
 * from. Uses `git ls-files` scoped to BUILD_INPUT_PATHS (not a recursive fs
 * walk) so it only looks at files that actually affect the build, and
 * ignores node_modules/build output/pb_data/test specs. */
function newestSourceMtime(): number {
	const files = execSync(`git ls-files -- ${BUILD_INPUT_PATHS.join(' ')}`, { cwd: PRIMOCMS_ROOT, encoding: 'utf8' })
		.split('\n')
		.filter(Boolean)
		.filter((relPath) => !BUILD_OUTPUT_EXCLUDES.some((excluded) => relPath.startsWith(excluded)))
	let newest = 0
	for (const relPath of files) {
		const full = path.join(PRIMOCMS_ROOT, relPath)
		try {
			const mtime = fs.statSync(full).mtimeMs
			if (mtime > newest) newest = mtime
		} catch {
			// deleted-but-tracked, e.g. a file staged for removal — ignore
		}
	}
	return newest
}

/** Refuses to silently run the suite against a missing or stale build.
 * Building here (rather than just checking) would make every local
 * `npx playwright test` invocation implicitly take the full ~40s rebuild,
 * which hides how expensive that step is and makes CI logs harder to
 * read; instead this fails fast with the exact command to run, per
 * `npm run test:e2e:build` in package.json / tests/e2e/build-under-test.sh. */
function assertBuildIsFresh() {
	const missing = [PRIMO_BINARY, FRONTEND_BUILD_DIR, COMMON_BUNDLE, CLI_ENTRY].filter((p) => !fs.existsSync(p))
	if (missing.length > 0) {
		throw new Error(
			`E2E prerequisites are missing:\n${missing.map((p) => `  - ${p}`).join('\n')}\n\n` +
				`Run 'npm install && npm run test:e2e:build' first (see tests/e2e/build-under-test.sh). ` +
				`This intentionally does not build automatically, to avoid masking build failures inside a test run.`
		)
	}

	const newestSource = newestSourceMtime()
	const binaryMtime = fs.statSync(PRIMO_BINARY).mtimeMs
	if (binaryMtime < newestSource) {
		throw new Error(
			`primo binary at ${PRIMO_BINARY} is older than the newest tracked file that affects its build (${BUILD_INPUT_PATHS.join(', ')}) — ` +
				`it does not reflect the current checkout and would silently test stale code. Re-run 'npm run test:e2e:build' before testing.`
		)
	}
}

// Starts one isolated PocketBase+Primo server shared by all spec files in
// this run. Each spec file seeds its own fixture site (see
// helpers/seed.ts's seedFixtureSite) rather than sharing a single global
// site, so specs don't interfere with each other's content even though
// they share this one server process.
export default async function globalSetup() {
	assertBuildIsFresh()

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
