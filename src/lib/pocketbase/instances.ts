import PocketBase from 'pocketbase'

const marketplace_url = import.meta.env.VITE_MARKETPLACE_URL || 'https://main.marketplace.primo.page'

export const self = new PocketBase(typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:3000')
export const marketplace = new PocketBase(marketplace_url)
