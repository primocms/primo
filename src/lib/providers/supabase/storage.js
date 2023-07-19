import supabase from './index'

export default {
  upload: async ({bucket, key, file, options = {}}) => {
    await supabase.storage
      .from(bucket)
      .upload(key, file, options)
    const { data: res } = supabase.storage.from('images').getPublicUrl(key)
    return res.publicUrl
  },
  download: async ({bucket, key}) => {
      const {data, error} = await supabase.storage
          .from(bucket)
          .download(key)
      return new Promise((resolve, reject) => {
          var reader = new FileReader()
          reader.onload = function () {
            resolve(reader.result)
          }
          reader.readAsText(data)
      })
  }
}