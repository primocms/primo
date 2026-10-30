// The host Node process represents an already installed command-capable agent.
// The product under test receives a new HOME, cache, prefix and PATH, then a
// real official portable Node runtime and the unchanged candidate npm archives.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { agentSetupPlan } from '../../src/lib/agent-setup.js'
export const exec = promisify(execFile)
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
export async function freshInstall() {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'primo-fresh-')))
	const home = path.join(root, 'home'),
		prefix = path.join(root, 'tools'),
		work = path.join(root, 'chosen folder'),
		empty = path.join(root, 'empty-path')
	for (const dir of [home, prefix, work, empty]) await fs.mkdir(dir, { recursive: true })
	const env = {
		...process.env,
		HOME: home,
		USERPROFILE: home,
		APPDATA: path.join(home, 'AppData/Roaming'),
		LOCALAPPDATA: path.join(home, 'AppData/Local'),
		XDG_CONFIG_HOME: path.join(home, '.config'),
		XDG_CACHE_HOME: path.join(home, '.cache'),
		npm_config_cache: path.join(home, 'npm-cache'),
		npm_config_userconfig: path.join(home, '.npmrc'),
		npm_config_globalconfig: path.join(home, 'global-npmrc'),
		PATH: empty,
		PRIMO_ENABLE_USAGE_STATS: 'false'
	}
	for (const key of Object.keys(env)) if (/^(PRIMO_|NODE_OPTIONS$|NODE_PATH$|NPM_CONFIG_|npm_config_prefix$|CLAUDE_|CODEX_HOME$|CURSOR_)/.test(key)) delete env[key]
	env.PRIMO_ENABLE_USAGE_STATS = 'false'
	let feed
	let stage = 'fresh-profile', stageStarted = performance.now()
	const cleanup = async () => {
		if (feed) await new Promise((resolve) => feed.close(resolve))
		await fs.rm(root, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 })
	}
	try {
		assert.deepEqual(await fs.readdir(home), [])
		await assert.rejects(exec('node', ['--version'], { env }), (e) => e.code === 'ENOENT')
		await assert.rejects(exec('primo', ['--version'], { env }), (e) => e.code === 'ENOENT')
		// npm lifecycle scripts use the OS shell, without inheriting a developer PATH.
		if (process.platform !== 'win32') env.npm_config_script_shell = '/bin/sh'
		const version = '22.17.0',
			platform = process.platform === 'win32' ? 'win' : process.platform,
			ext = process.platform === 'win32' ? 'zip' : 'tar.xz'
		const name = `node-v${version}-${platform}-${process.arch}`,
			archive = `${name}.${ext}`,
			base = `https://nodejs.org/dist/v${version}/`
		console.log('Fresh profile: acquiring Node ' + version + ' for ' + process.platform + ' ' + process.arch)
		// Use the OS HTTPS downloader with IPv4: hosted Mac runners can stall in
		// Node's external fetch transport. Keep TLS verification, checksum
		// validation and the original two-minute bootstrap download budget.
		const curl = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'curl.exe') : '/usr/bin/curl'
		const official = async (url, binary) => {
			const file = path.join(root, binary ? archive : 'SHASUMS256.txt')
			await exec(
				curl,
				[
					'--disable',
					'--ipv4',
					'--fail',
					'--location',
					'--proto',
					'=https',
					'--proto-redir',
					'=https',
					'--tlsv1.2',
					'--connect-timeout',
					'15',
					'--max-time',
					'55',
					'--retry',
					'1',
					'--retry-all-errors',
					'--retry-delay',
					'1',
					'--output',
					file,
					url
				],
				{ timeout: 120000, maxBuffer: 1024 * 1024 }
			)
			return binary ? fs.readFile(file) : fs.readFile(file, 'utf8')
		}
		const distribution = process.env.PRIMO_TEST_NODE_DISTRIBUTIONS ? path.resolve(process.env.PRIMO_TEST_NODE_DISTRIBUTIONS) : null
		let bytes,
			expected,
			runtimeRoot = name,
			archiveName = archive,
			binaryHash
		if (distribution) {
			const provenance = JSON.parse(await fs.readFile(path.join(distribution, 'provenance.json'), 'utf8'))
			const known = JSON.parse(await fs.readFile(new URL('./node-mirrors.json', import.meta.url), 'utf8'))
			assert.equal(provenance.sourceCommit, process.env.PRIMO_CANDIDATE_SHA, 'runtime provenance must match candidate')
			assert.equal(provenance.node, version)
			const pinned = known.mirrors.find((item) => item.platform === process.platform && item.arch === process.arch)
			const receipt = provenance.archives.find((item) => item.platform === process.platform && item.arch === process.arch)
			assert.deepEqual(receipt, pinned, 'runtime receipt must match pinned mirror and official executable hashes')
			assert.ok(pinned)
			bytes = await fs.readFile(path.join(distribution, pinned.name))
			expected = pinned.sha256
			runtimeRoot = pinned.root
			archiveName = pinned.name
			binaryHash = pinned.binarySha256
		} else {
			const result = await Promise.all([official(base + archive, true), official(base + 'SHASUMS256.txt', false)])
			bytes = result[0]
			expected = result[1]
				.split('\n')
				.find((line) => line.endsWith('  ' + archive))
				?.split(' ')[0]
		}
		assert.equal(sha(bytes), expected, 'runtime archive checksum')
		const downloaded = path.join(root, archiveName)
		await fs.writeFile(downloaded, bytes)
		const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : '/usr/bin/tar'
		await exec(tar, ['-xf', downloaded, '-C', root], { timeout: 120000 })
		const bin = path.join(root, runtimeRoot, process.platform === 'win32' ? '' : 'bin'),
			node = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node')
		if (binaryHash) assert.equal(sha(await fs.readFile(node)), binaryHash, 'mirrored executable must match the official Node distribution byte for byte')
		const npm = path.join(root, runtimeRoot, process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js')
		env.PATH = [bin, path.join(prefix, 'node_modules/.bin'), ...(process.platform === 'win32' ? [path.join(process.env.SystemRoot, 'System32')] : [])].join(path.delimiter)
		assert.equal((await exec(node, ['--version'], { env })).stdout.trim(), 'v' + version)
		const manifest = JSON.parse(await fs.readFile('tests/staging/rc8-packages.json', 'utf8'))
		const archives = [manifest.mcp, manifest.cli].map((item) => path.resolve('release/vendor', item.archive))
		for (const item of [manifest.mcp, manifest.cli]) assert.equal(sha(await fs.readFile(path.resolve('release/vendor', item.archive))), item.sha256, 'candidate package checksum')
		console.log('Fresh profile: installing exact CLI and MCP archives')
		stage = 'npm-install'; stageStarted = performance.now()
		await exec(node, [npm, 'install', '--prefix', prefix, '--no-audit', '--no-fund', '--timing', ...archives], { env, cwd: root, timeout: 180000, maxBuffer: 4 * 1024 * 1024 })
		stage = 'installed-runtime-verification'; stageStarted = performance.now()
		console.log('Fresh profile: packages installed; verifying runtime and MCP')
		const cli = path.join(prefix, 'node_modules/primo-cli/dist/index.js'),
			require = createRequire(cli),
			mcp = require.resolve('primo-mcp')
		const run = (args, options = {}) => exec(node, [cli, ...args], { env, cwd: work, timeout: 60000, maxBuffer: 4 * 1024 * 1024, ...options })
		const start = (args) => {
			const child = spawn(node, [cli, ...args], { env, cwd: work, stdio: ['ignore', 'pipe', 'pipe'] })
			child.output = ''
			child.stdout.on('data', (b) => (child.output += b))
			child.stderr.on('data', (b) => (child.output += b))
			return child
		}
		assert.equal((await run(['--version'])).stdout.trim(), '0.3.0')
		assert.equal(JSON.parse(await fs.readFile(path.join(prefix, 'node_modules/primo-mcp/package.json'), 'utf8')).version, '0.1.11')
		assert.equal(
			await fs.access(path.join(home, '.primo/tokens.json')).then(
				() => true,
				() => false
			),
			false
		)
		// Unpublished RCs cannot be downloaded from public /latest. Redirect only the
		// two release URLs to an isolated feed serving the actual frozen executable;
		// ensure_binary still performs its normal managed download and version check.
		const binary = path.resolve(process.env.PRIMO_TEST_CMS_BINARY),
			binaryBytes = await fs.readFile(binary),
			requests = []
		const asset = `primo_${process.platform === 'win32' ? 'windows' : process.platform}_${process.arch === 'x64' ? 'amd64' : process.arch}${process.platform === 'win32' ? '.exe' : ''}`
		const pinnedURL = `https://github.com/primocms/primo/releases/download/v3.3.2/${asset}`
		const releaseURL = agentSetupPlan('https://onboarding.example.test').cmsRelease
		feed = http.createServer((req, res) => {
			requests.push(req.url)
			if (req.url === '/latest') {
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify({ tag_name: 'v3.3.2' }))
			} else if (req.url === '/candidate-release') {
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify({ tag_name: 'v3.3.2', assets: [{ name: asset, browser_download_url: pinnedURL }] }))
			} else if (req.url === '/' + asset) res.end(binaryBytes)
			else {
				res.writeHead(404)
				res.end()
			}
		})
		await new Promise((resolve) => feed.listen(0, '127.0.0.1', resolve))
		const origin = `http://127.0.0.1:${feed.address().port}`
		const preload = path.join(root, 'candidate-feed.cjs')
		const routesFile = path.join(root, 'candidate-release-routes.json')
		await fs.writeFile(
			routesFile,
			JSON.stringify({
				'https://api.github.com/repos/primocms/primo/releases/latest': origin + '/latest',
				['https://github.com/primocms/primo/releases/latest/download/' + asset]: origin + '/' + asset,
				[releaseURL]: origin + '/candidate-release',
				[pinnedURL]: origin + '/' + asset
			})
		)
		await fs.copyFile(new URL('./candidate-feed.cjs', import.meta.url), preload)
		env.PRIMO_TEST_RELEASE_ROUTES = routesFile
		env.NODE_OPTIONS = '--require ' + JSON.stringify(preload)
		const installPinnedCMS = async () => {
			const destination = path.join(home, 'candidate-cms', process.platform === 'win32' ? 'primo.exe' : 'primo')
			await exec(node, [fileURLToPath(new URL('./install-candidate.mjs', import.meta.url)), releaseURL, destination, asset, pinnedURL], { env, timeout: 30000 })
			assert.equal(sha(await fs.readFile(destination)), sha(binaryBytes), 'exact tagged CMS download checksum')
			assert.match((await exec(destination, ['--version'], { env })).stdout, /v3\.3\.2/)
			env.PRIMO_BINARY = destination
			return destination
		}
		const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')))
		const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')))
		const connect = async (launch = { command: node, args: [mcp] }) => {
			const client = new Client({ name: 'fresh-agent-acceptance', version: '1.0.0' })
			await client.connect(new StdioClientTransport({ ...launch, cwd: work, env: { ...env, PATH: empty }, stderr: 'pipe' }))
			assert.equal(client.getServerVersion().version, '0.1.11')
			return client
		}
		const evidence = {
			platform: process.platform,
			arch: process.arch,
			sourceCommit: process.env.PRIMO_CANDIDATE_SHA || null,
			initial: { nodeOnPath: false, primoOnPath: false, credentials: false, packageCache: false },
			node: version,
			nodeArchiveSha256: expected,
			nodeExecutableSha256: sha(await fs.readFile(node)),
			nodeDelivery: distribution ? 'pinned GitHub mirror; official executable hash verified; fresh private installation' : 'official HTTPS download; fresh private installation',
			cli: '0.3.0',
			mcp: '0.1.11',
			cms: 'v3.3.2',
			cmsSha256: sha(binaryBytes),
			privateCandidateFeed: true,
			archiveSha256: await Promise.all(archives.map(async (file) => ({ name: path.basename(file), sha256: sha(await fs.readFile(file)) }))),
			checks: []
		}
		return {
			root,
			home,
			prefix,
			work,
			env,
			node,
			cli,
			mcp,
			run,
			start,
			connect,
			cleanup,
			evidence,
			requests,
			installPinnedCMS,
			managedBinary: path.join(home, '.primo/bin', process.platform === 'win32' ? 'primo.exe' : 'primo')
		}
	} catch (error) {
		// The fresh HOME is removed below. Preserve bounded, credential-free npm
		// timing evidence before cleanup, so a timeout is not mistaken for a
		// package/runtime failure. Do not retry or extend the install deadline.
		if (stage === 'npm-install') {
			const logDir = path.join(home, 'npm-cache', '_logs')
			const names = (await fs.readdir(logDir).catch(() => [])).filter(name => name.endsWith('-debug-0.log')).sort()
			const log = names.length ? await fs.readFile(path.join(logDir, names.at(-1)), 'utf8').catch(() => '') : ''
			const sanitize = text => text.replace(/https?:\/\/[^\s)]+/g, value => {
				try { const url = new URL(value); return url.protocol + '//' + url.host + url.pathname } catch { return '[URL]' }
			}).replace(/(?:npm_[A-Za-z0-9]+|eyJ[A-Za-z0-9_.-]{30,})/g, '[REDACTED]')
			const diagnostic = {
				status: 'FAIL_FRESH_NPM_INSTALL', sourceCommit: process.env.PRIMO_CANDIDATE_SHA || null,
				platform: process.platform, stage, elapsedMs: Math.round(performance.now() - stageStarted),
				code: error.code ?? null, signal: error.signal ?? null, killed: error.killed ?? false,
				npmLog: sanitize(log.split('\n').filter(line => /^\d+ (?:http|timing|error|verbose (?:stack|cwd|os|node|npm|exit|code))\b/.test(line)).slice(-80).join('\n')).slice(-16000)
			}
			await fs.writeFile('fresh-install-failure.json', JSON.stringify(diagnostic, null, 2) + '\n')
			console.error(JSON.stringify(diagnostic))
		}
		await cleanup()
		throw error
	}
}
export async function stop(child) {
	if (!child || child.exitCode !== null || child.signalCode !== null) return
	const closed = new Promise((resolve) => child.once('close', resolve))
	if (process.platform === 'win32') {
		await exec(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F']).catch((error) => {
			if (child.exitCode === null && child.signalCode === null) throw error
		})
		await closed
		return
	}
	child.kill('SIGTERM')
	const timer = setTimeout(() => child.kill('SIGKILL'), 10000)
	timer.unref()
	try {
		await closed
	} finally {
		clearTimeout(timer)
	}
}
export async function until(check, message, timeout = 60000) {
	const end = Date.now() + timeout
	while (Date.now() < end) {
		if (await check()) return
		await new Promise((resolve) => setTimeout(resolve, 150))
	}
	assert.fail(message)
}
export async function call(client, name, args = {}) {
	const result = await client.callTool({ name, arguments: args })
	assert.ok(!result.isError, JSON.stringify(result))
	return result.structuredContent ?? JSON.parse(result.content.find((c) => c.type === 'text').text)
}
