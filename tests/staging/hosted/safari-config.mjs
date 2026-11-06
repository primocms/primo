import fs from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {configIssues,invariant} from '../launch/lib.mjs'
export async function publicSafariConfig(input){
 invariant(input && Object.keys(input).every(k=>['environmentId','cmsOrigin','cmsProbePath','publicPages'].includes(k)),'Only public fixture fields are accepted; never pass accounts or credentials')
 const u=new URL(input.cmsOrigin)
 invariant(u.protocol==='https:' && u.origin===input.cmsOrigin && u.hostname.endsWith('.up.railway.app'),'A disposable provider HTTPS origin is required')
 invariant(input.publicPages?.length===1 && input.publicPages[0].url===input.cmsOrigin+'/','Only the owned same-origin public fixture may be opened')
 const config=JSON.parse(await fs.readFile(new URL('../launch/staging.example.json',import.meta.url),'utf8'))
 Object.assign(config,input,{actors:[],outputDirectory:'safari-results',devices:[{name:'ci-safari',physical:false,transportUrlEnv:'PRIMO_QA_SAFARI_WEBDRIVER',capabilities:{browserName:'safari',platformName:'mac'}}]})
 const issues=configIssues(config,{device:'ci-safari',env:{PRIMO_QA_SAFARI_WEBDRIVER:'http://127.0.0.1:4444'}})
 invariant(!issues.length,'Invalid public Safari configuration: '+issues.join('; '))
 return config
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 invariant(process.env.GITHUB_ACTIONS==='true','This entry point runs only on the disposable CI runner')
 const config=await publicSafariConfig(JSON.parse(process.env.PRIMO_QA_SAFARI_CONFIGURATION || '{}'))
 await fs.writeFile('safari.local.json',JSON.stringify(config),{flag:'wx',mode:0o600})
 console.log('Prepared public-only Safari fixture; no accounts or credentials accepted.')
}
