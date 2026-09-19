import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const PRIMOCMS_ROOT = path.resolve(__dirname, '../../..')
export const PRIMO_BINARY = path.join(PRIMOCMS_ROOT, 'primo')
// Pinned via package.json's exact-version "primo-cli" devDependency (see
// package.json) rather than a sibling ../primo-cli checkout, so the CLI
// under test is a specific, reproducible published version and never
// silently drifts to whatever happens to be built in a sibling repo.
export const CLI_ENTRY = path.resolve(PRIMOCMS_ROOT, 'node_modules/primo-cli/dist/index.js')
export const FIXTURE_SITE_DIR = path.join(__dirname, '../fixtures/fixture-site')
export const TEST_DATA_DIR = '/tmp/primo-e2e-pbdata'
export const SERVER_LOG = '/tmp/primo-e2e-server.log'
export const IDS_FILE = '/tmp/primo-e2e-fixture-ids.json'

export const TEST_HTTP_ADDR = '127.0.0.1:8095'
export const TEST_SERVER_URL = `http://${TEST_HTTP_ADDR}`
export const FIXTURE_SITE_ID = 'xaji0y6dpbhsahx'
