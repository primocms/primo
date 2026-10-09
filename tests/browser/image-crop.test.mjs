import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { chromium } from '@playwright/test'

const source = await readFile(new URL('../../src/lib/builder/field-types/image-crop.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const svg = (width, height, color) =>
	`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`

test('responsive snapshots preserve picture sources until the editor replaces the image', async () => {
	const browser = await chromium.launch()
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
		const phone = svg(50, 100, 'blue'),
			desktop = svg(100, 50, 'red'),
			replacement = svg(80, 80, 'green')
		await page.setContent(`<style>img {width:100%;height:200px;object-fit:cover}</style><picture><source media="(max-width:600px)" srcset="${phone}"><img id="selected" src="${desktop}"></picture>`)
		const snapshot = await page.evaluate(
			({ code }) => {
				const module = { exports: {} }
				Function('exports', 'module', code)(module.exports, module)
				const image = document.querySelector('#selected')
				return module.exports.image_crop_snapshot(image, image.src)
			},
			{ code }
		)
		for (const [width, expected] of [
			[390, phone],
			[1280, desktop]
		]) {
			await page.evaluate(
				({ snapshot, width }) => {
					document.querySelectorAll('iframe').forEach((frame) => frame.remove())
					const frame = document.createElement('iframe')
					frame.style.width = `${width}px`
					frame.srcdoc = snapshot
					document.body.append(frame)
				},
				{ snapshot, width }
			)
			await page.waitForFunction((expected) => document.querySelector('iframe')?.contentDocument?.querySelector('img[data-primo-crop-target]')?.currentSrc === expected, expected)
			assert.equal(
				await page
					.frameLocator('iframe')
					.locator('img[data-primo-crop-target]')
					.evaluate((image) => image.currentSrc),
				expected
			)
		}
		const changed = await page.evaluate(
			({ code, replacement }) => {
				const module = { exports: {} }
				Function('exports', 'module', code)(module.exports, module)
				return module.exports.image_crop_snapshot(document.querySelector('#selected'), replacement)
			},
			{ code, replacement }
		)
		await page.evaluate((changed) => {
			const frame = document.querySelector('iframe')
			frame.style.width = '390px'
			frame.srcdoc = changed
		}, changed)
		await page.waitForFunction((expected) => document.querySelector('iframe')?.contentDocument?.querySelector('img[data-primo-crop-target]')?.currentSrc === expected, replacement)
		assert.equal(await page.frameLocator('iframe').locator('picture source').count(), 0)
	} finally {
		await browser.close()
	}
})
