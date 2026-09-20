/** Public, form-scoped client. Administrative credentials never belong here. */
export function createPrimo({ siteId, baseURL = '' }) {
	if (!siteId) throw new Error('A siteId is required')
	return Object.freeze({
		forms: Object.freeze({
			async submit(form, data, { requestId, website = '' } = {}) {
				if (!requestId) throw new Error('Keep a requestId across retries of the same submission')
				const response = await fetch(`${baseURL.replace(/\/$/, '')}/api/primo/forms/${encodeURIComponent(siteId)}/${encodeURIComponent(form)}/submit`, {
					method: 'POST',
					credentials: 'omit',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data, requestId, website })
				})
				const result = await response.json()
				if (!response.ok) throw new Error(result.message || 'Could not submit form')
				return result
			}
		})
	})
}
