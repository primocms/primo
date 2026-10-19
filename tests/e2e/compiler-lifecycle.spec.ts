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

test('editor recovers a Firefox engine regexp failure in a fresh compiler worker without changing content', async ({page,request}) => {
 test.setTimeout(90000)
 const {token} = await devAuth(request), ids = await seedFixtureSite(token, 'Firefox compiler recovery')
 const entries = async () => {
  const response = await request.get('/api/collections/page_section_entries/records', {headers:{Authorization:`Bearer ${token}`}, params:{filter:`section = "${ids.sectionId}"`,sort:'id',perPage:200}})
  expect(response.ok()).toBeTruthy()
  return (await response.json()).items.map(({id,field,parent,locale,value}) => ({id,field,parent,locale,value}))
 }
 const before = await entries(), errors: string[] = []
 let workers = 0
 page.on('console', message => {if(message.type() === 'error' && /^(Build error:|Compilation error from rollup worker:)/.test(message.text())) errors.push(message.text())})
 await page.addInitScript(() => {
  const NativeWorker = window.Worker
  ;(window as any).__compilerFailures = []
  window.Worker = class extends NativeWorker {
   constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options)
    if (String(url).includes('rollup.worker')) this.addEventListener('message', event => {
     if (Array.isArray(event.data) && event.data[2]?.error) (window as any).__compilerFailures.push(event.data[2])
    })
   }
  }
 })
 await page.route(/\/rollup\.worker[-.].*\.js(?:\?|$)/, async route => {
  const response = await route.fetch()
  // Match the precise native regexp operation in the captured Firefox trace.
  // This worker stays damaged: retrying in the same worker cannot pass.
  const fault = String.raw`const originalReplace = String.prototype.replace;
   String.prototype.replace = function(search, replacement) {
    if (search instanceof RegExp && search.source === '[^\\w$]') {
     const error = new Error('too much recursion'); error.name = 'InternalError'; throw error;
    }
    return Reflect.apply(originalReplace, this, [search, replacement]);
   };`
  await route.fulfill({response, body:(++workers === 1 ? fault : '') + await response.text()})
 })
 await loginAsDeveloper(page, ids.siteId)
 await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({timeout:45000})
 expect(workers, 'The damaged worker must be replaced once').toBe(2)
 const failures = await page.evaluate(() => (window as any).__compilerFailures)
 expect(failures.length, 'The injected native regexp failure must actually reach the worker response').toBeGreaterThan(0)
 expect(failures.every(failure => failure.failureKind === 'engine-recursion' && failure.error.includes('too much recursion'))).toBeTruthy()
 expect(errors, 'Successful recovery must not report a failed build').toEqual([])
 expect(await entries(), 'Recovery must retain content IDs, values and bindings').toEqual(before)
})
