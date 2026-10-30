import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export function releaseChannel({ tag, prerelease, repository }) {
	if (typeof prerelease !== 'boolean') throw new Error('The release prerelease flag is required')
	if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository || '')) throw new Error('Invalid repository')
	const match = /^v(3\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(tag || '')
	if (!match) throw new Error('Expected an exact v3 semantic version tag')
	const version = tag.slice(1)
	const candidate = Boolean(match[2])
	if (candidate !== prerelease) throw new Error('Release prerelease flag must match its version tag')
	const aliases = candidate ? [version] : [version, match[1].split('.').slice(0, 2).join('.'), '3', 'latest']
	return { version, prerelease: candidate, tags: aliases.map(alias => `ghcr.io/${repository.toLowerCase()}:${alias}`) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
	const channel = releaseChannel({ tag: event.release?.tag_name, prerelease: event.release?.prerelease, repository: process.env.GITHUB_REPOSITORY })
	if (event.release?.draft !== false) throw new Error('Only a published release can publish an image')
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${channel.version}\ntags<<PRIMO_RELEASE_TAGS\n${channel.tags.join('\n')}\nPRIMO_RELEASE_TAGS\n`)
	console.log(JSON.stringify(channel))
}
