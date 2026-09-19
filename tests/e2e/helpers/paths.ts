import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const PRIMOCMS_ROOT = path.resolve(__dirname, '../../..')
export const PRIMO_BINARY = path.join(PRIMOCMS_ROOT, 'primo')
export const CLI_ENTRY = path.resolve(PRIMOCMS_ROOT, '../primo-cli/dist/index.js')
export const FIXTURE_SITE_DIR = path.join(__dirname, '../fixtures/fixture-site')
export const TEST_DATA_DIR = '/tmp/primo-e2e-pbdata'
export const SERVER_LOG = '/tmp/primo-e2e-server.log'
export const IDS_FILE = '/tmp/primo-e2e-fixture-ids.json'

export const TEST_HTTP_ADDR = '127.0.0.1:8095'
export const TEST_SERVER_URL = `http://${TEST_HTTP_ADDR}`
export const FIXTURE_SITE_ID = 'xaji0y6dpbhsahx'
