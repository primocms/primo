let database_listener = () => {}

export function database_subscribe(fn) {
	database_listener = fn
}

export function database_unsubscribe() {
	database_listener = null
}

/**
 * Runs when data changes.
 * @param {{
 *  table: string,
 *  action: string,
 *  id?: string | number,
 *  data?: object | string,
 *  match?: object
 * }} payload - The data that changed
 * @returns {Promise<Array<object>|null>} - Returns null or an object
 */
export async function dataChanged(payload) {
	return await database_listener(payload)
}

let storage_listener = () => {}

export function storage_subscribe(fn) {
	storage_listener = fn
}

export function storage_unsubscribe(fn) {
	storage_listener = null
}

/**
 * Runs when storing files
 * @param {{
 *  action: string,
 *  key: string,
 *  file: File,
 *  options?: object,
 * }} payload - The data that changed
 * @return Promise<{{ url: string, size: number }}>
 */
export async function storageChanged(payload) {
	return await storage_listener(payload)
}

let realtime_listener = () => {}
export function realtime_subscribe(fn) {
	realtime_listener = fn
}

/**
 * Runs when realtime data updates
 * @param {{
 *  instance: string,
 *  user: object,
 *  data: object,
 * }} payload - The data that changed
 */
export async function realtimeChanged(payload) {
	return await realtime_listener(payload)
}

let broadcast_listener = () => {}
export function broadcast_subscribe(fn) {
	broadcast_listener = fn
}

/**
 * Runs when broadcast data updates
 * @param {{
 *  bucket: string,
 *  action: string,
 *  key: string,
 *  file: string,
 *  options: object,
 * }} payload - The data that changed
 */
export async function broadcastChanged(payload) {
	return await broadcast_listener(payload)
}
