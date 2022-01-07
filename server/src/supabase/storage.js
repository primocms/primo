import supabase from './core'

const bucketID = 'sites'

export async function downloadPagePreview(id) {
  const { data } = await supabase
  .storage
  .from(bucketID)
  .download(`${id}/preview.html`)
  return data ? await data.text() : "";
}

export async function uploadPagePreview({ path, preview }) {
  let res = await supabase
    .storage
    .from(bucketID)
    .upload(path, preview, {
      upsert: true
    })

  return res
}

export async function updatePagePreview({ path, preview }) {
  let res = await supabase
    .storage
    .from(bucketID)
    .update(path, preview, {
      upsert: true
    })

  return res
}

export async function uploadSiteData({ id, data }) {
  const json = JSON.stringify(data)
  const res = await supabase
    .storage
    .from(bucketID)
    .upload(`${id}/site.json`, json, {
      upsert: true
    })
  return res
}

export async function updateSiteData({ id, data }) {
  const json = JSON.stringify(data)
  const res = await supabase
    .storage
    .from(bucketID)
    .update(`${id}/site.json`, json, {
      upsert: true
    })
  return res
}

export async function uploadSiteImage({ id, file }) {
  const {data,error} = await supabase
    .storage
    .from(bucketID)
    .upload(`${id}/assets/${file.name}`, file)

  const { publicURL } = await supabase
    .storage
    .from(bucketID)
    .getPublicUrl(`${id}/assets/${file.name}`)

  if (error) {
    console.warn(error)
  }

  return publicURL 
}

export async function downloadSiteImage(key) {
  const {data,error} = await supabase
    .storage
    .from(bucketID)
    .download(key)
  return data || false
}

export async function downloadSiteData(id) {
  const {data} = await supabase
    .storage
    .from(bucketID)
    .download(`${id}/site.json`)
  const json = await data.text()
  return JSON.parse(json)
}

export async function deleteSiteData(id) {
  const { data, error } = await supabase
  .storage
  .from(bucketID)
  .remove([id])
  return data ? true : false
}