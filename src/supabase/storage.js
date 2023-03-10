import supabase from './core'

const bucketID = 'sites'

export async function uploadSiteFile({ id, file }) {
  const path = `${id}/site-files/${file.file}`
  await supabase
    .storage
    .from(bucketID)
    .upload(path, file.data, {
      upsert: true
    })
  return file.file
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
