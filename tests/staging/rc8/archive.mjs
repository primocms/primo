import path from 'node:path'
import {execFileSync} from 'node:child_process'

// GNU tar interprets a Windows drive colon in -f as a remote host. Keep
// the native absolute path in cwd; pass only the archive's local basename.
export function archiveFiles(archive) {
 return execFileSync('tar',['-tzf',path.basename(archive)],{cwd:path.dirname(archive),encoding:'utf8'}).trim().split('\n').filter(file=>!file.endsWith('/'))
}
export function archiveFile(archive,file) {
 return execFileSync('tar',['-xOzf',path.basename(archive),file],{cwd:path.dirname(archive),maxBuffer:16*1024*1024})
}
