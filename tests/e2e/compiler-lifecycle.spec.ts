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

test('concurrent editor compilation recovers a failed runtime download without a compiler error', async ({page,context,request})=>{
 test.setTimeout(90000)
 const {token}=await devAuth(request),ids=await seedFixtureSite(token,'Compiler download recovery')
 const headers={Authorization:`Bearer ${token}`}
 const entries=async()=>{
  const response=await request.get('/api/collections/page_section_entries/records',{headers,params:{filter:`section = "${ids.sectionId}"`,sort:'id',perPage:200}})
  expect(response.ok()).toBeTruthy();return (await response.json()).items.map(({id,field,parent,locale,value})=>({id,field,parent,locale,value}))
 }
 const before=await entries(),errors:string[]=[];let downloads=0
 page.on('console',message=>{if(message.type()==='error'&&/^(Build error:|Compilation error from rollup worker:)/.test(message.text()))errors.push(message.text())})
 await context.route(/^https:\/\/esm\.sh\/svelte@[^/]+\/internal\/client(?:\?|$)/,async route=>{
  if(++downloads===1)await route.abort('failed');else await route.continue()
 })
 await loginAsDeveloper(page,ids.siteId)
 await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({timeout:45000})
 expect(downloads,'The real compiler must retry the injected runtime failure, sharing the retry across its jobs').toBe(2)
 expect(errors,'A recovered module request must not fail a compiler job').toEqual([])
 expect(await entries(),'Compiler recovery must preserve stored content and bindings').toEqual(before)
})
