import axios from 'axios'
import {chain, find} from 'lodash-es'
import CryptoJS from 'crypto-js'
import Blob from "cross-blob"

// pass in site
export async function publishSite({ siteID, host, files, activeDeployment }) {
  let deployment
  let error

  try {
    if (host.name === 'vercel') {

      const uploaded = await Promise.all(
        files.map(async file => {
          const sha = hash(file.data)
          const {data} = await axios.post('https://api.vercel.com/v2/now/files', file.data, {
            headers: {
              'x-vercel-digest': sha,
              'Authorization': `Bearer ${host.token}`,
              'Content-Type': 'text/plain',
            }
          }).catch(e => ({data:null}))

          if (data) return {
            sha,
            file: file.file,
            size: new Blob([file.data]).size
          }
        })
      )

      const { data } = await axios
        .post(
          'https://api.vercel.com/v12/now/deployments',
          {
            name: siteID,
            files: uploaded,
            projectSettings: {
              framework: null,
            },
            target: 'production',
          },
          {
            headers: {
              Authorization: `Bearer ${host.token}`,
            },
          }
        ).catch(e => {
          console.log(e.message)
          return {data:null}
        })
  
        console.log({data})
      deployment = {
        id: data.projectId,
        url: `https://${data.alias.pop()}`,
        created: data.createdAt,
      }
    } else if (host.name === 'netlify') {
      if (!activeDeployment) {
        const {data} = await uploadFiles({
          endpoint: 'https://api.netlify.com/api/v1/sites',
          files
        })
        if (data) {
          deployment = {
            id: data.id,
            deploy_id: data.deploy_id,
            url: `https://${data.subdomain}.netlify.com`,
            created: Date.now(),
          }
        } 
      } else {
        const {data} = await uploadFiles({
          endpoint: `https://api.netlify.com/api/v1/sites/${activeDeployment.id}/deploys`,
          files
        })
        if (data) {
          deployment = {
            id: data.site_id,
            deploy_id: data.id,
            url: data.ssl_url,
            created: Date.now(),
          }
        }
      }
    } else if (host.name === 'github') {
      // console.log({activeDeployment})
      if (activeDeployment) {
        const sha = await pushSite({
          token: host.token,
          repo: activeDeployment.id,
          files,
          activeSha: activeDeployment.deploy_id
        })
        deployment = {
          ...activeDeployment,
          deploy_id: sha,
          created: Date.now(),
        }
      } else {
        const { html_url, full_name } = await createRepo({ token: host.token, name: siteID })
        const sha = await pushSite({
          token: host.token,
          repo: full_name,
          files
        })
        deployment = {
          id: full_name,
          deploy_id: sha,
          url: html_url,
          created: Date.now(),
        }
      }
    }
  } catch(e) {
    error = e.toString()
    console.error(error)
  }
  return { deployment, error }

  async function uploadFiles({ endpoint, files }) {
    let error = 'Could not upload files to Netlify'
    const filesToUpload = await Promise.all(chain(files.map(async f => {
      const hash = await digestMessage(f.data);
      return ({ 
        hash, 
        file: `/${f.file}`
      })
    }))
      .keyBy('file')
      .mapValues('hash')
      .value())

    // upload hashes to netlify
    const res = await axios
      .post(
        endpoint,
        {
          "files": filesToUpload
        },
        {
          headers: {
            Authorization: `Bearer ${host.token}`,
          },
        }
      )

    // upload missing files
    if (res.data) {
      const {required, id, deploy_id} = res.data // deploy_id for new site, id for existing site (!?)
      await Promise.all(
        required.map(async (hash) => {
          const fileName = Object.keys(filesToUpload).find(key => filesToUpload[key] === hash)
          const {data} = find(files, ['file', fileName.slice(1)])
          await axios.put(`https://api.netlify.com/api/v1/deploys/${deploy_id || id}/files${fileName}`, 
            data, 
            {
              headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${host.token}`
              }
          })
        })
      )
      return { data: res.data, error: null }
    } else return { data: null, error }
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
  async function digestMessage(message) {
    const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);           // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }
}


async function pushSite({ token, repo, files, activeSha = null }) {
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  }
  const tree = await createTree()
  const commit = await createCommit(tree.sha)
  const final = await pushCommit(commit.sha)
  return final.object.sha

  async function createTree() {
    const bundle = files.map(file => ({
      path: file.file,
      content: file.data,
      type: 'blob',
      mode: '100644'
    }))
    const {data} = await axios.post(`https://api.github.com/repos/${repo}/git/trees`, {
      tree: bundle
    }, { headers })
    return data
  }

  async function createCommit(tree) {
    const {data} = await axios.post(`https://api.github.com/repos/${repo}/git/commits`, {
      message: 'Update site',
      tree,
      ... activeSha ? { parents: [activeSha] } : {}
    }, { headers })
    return data
  }

  async function pushCommit(commitSha) {
    const {data} = await axios.patch(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
      sha: commitSha,
      force: true
    }, { headers })
    return data
  }
}

async function createRepo({ token, name }) {
  const headers = { 'Authorization': `Bearer ${token}` }
  const {data} = await axios.post(`https://api.github.com/user/repos`, {
    name,
    auto_init: true
  }, { headers })
  return data
}


function hash(string) {
  return CryptoJS.SHA1(string).toString(CryptoJS.enc.Hex);
}