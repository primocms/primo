import supabase from './core';

export async function getFiles(bucket, path, files = []) {
    const { data: fileList, error: fileListError } = await supabase.storage.from(bucket).list(path)

    if (fileListError) console.warn(`File deletion error: ${fileListError.message}`)

    if (!fileListError && fileList) {
        files = [...files, ...fileList.map(async (x) => {
            if (x.id) return `${path}/${x.name}`
            return await getFiles(bucket, `${path}/${x.name}`, files)
        })]
    }
    return files
}

export default {
    getFiles,
};