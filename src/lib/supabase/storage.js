import {get} from 'svelte/store'
import { page } from '$app/stores'
import supabase from './index'

export async function getFiles(bucket, path, files = []) {
    let dirs = []
    const { data: fileList, error: fileListError } = await supabase.storage.from(bucket).list(path)

    if (fileListError) console.warn(`File listing error: ${fileListError.message}`)

    if (!fileListError && fileList) {
        files = [...files, ...fileList.map((x) => {
            if (!x.id) dirs.push(`${path}/${x.name}`)
            return `${path}/${x.name}`
        })]
    }

    for (const dir of dirs) {
        files = await getFiles(bucket, dir, files)
    }

    return files
}

export default {
    getFiles,
};