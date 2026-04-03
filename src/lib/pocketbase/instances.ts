import PocketBase from 'pocketbase'

export const self = new PocketBase(typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:3000')
export const marketplace = new PocketBase('https://marketplace.palacms.com')
