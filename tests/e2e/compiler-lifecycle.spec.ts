import { test, expect } from '@playwright/test'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'
import { loginAsDeveloperAtDashboard, loginAsDeveloper, canvasFrame } from './helpers/editor'

test('auth and dashboard stay worker-free; entering the editor starts working compilers', async ({ page, request }) => {
 const compilerRequests: string[] = []
 page.on('request', request => {
  if (/\/(?:rollup|postcss)\.worker[-.]/.test(new URL(request.url()).pathname)) compilerRequests.push(request.url())
 })
 await page.route('**/api/primo/dev-auth', route => route.fulfill({ status: 403, body: '{}' }))
 await page.goto('/admin/auth')
 await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
 expect(compilerRequests).toEqual([])
 await page.unroute('**/api/primo/dev-auth')
 const { token } = await devAuth(request)
 const { siteId } = await seedFixtureSite(token, 'Compiler lifecycle fixture')
 await loginAsDeveloperAtDashboard(page)
 await expect(page.getByRole('button', { name: 'Create Site', exact: true })).toBeVisible()
 expect(compilerRequests).toEqual([])
 await loginAsDeveloper(page, siteId)
 await expect(canvasFrame(page).locator('h1').first()).toBeVisible()
 await expect.poll(() => compilerRequests.some(url => /\/rollup\.worker[-.]/.test(new URL(url).pathname))).toBeTruthy()
 await expect.poll(() => compilerRequests.some(url => /\/postcss\.worker[-.]/.test(new URL(url).pathname))).toBeTruthy()
})
