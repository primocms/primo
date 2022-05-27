import axios from 'axios'
import JSZip from 'jszip'
import {chain, find} from 'lodash-es'
import crypto from 'node:crypto'

// pass in site
export async function publishSite({ siteID, host, files, activeDeployment }) {
  let deployment
  try {
    if (host.name === 'vercel') {
      const { data } = await axios
        .post(
          'https://api.vercel.com/v12/now/deployments',
          {
            name: siteID,
            files,
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
        )
        .catch((e) => ({ data: null }))
  
      deployment = {
        id: data.projectId,
        url: `https://${data.alias.pop()}`,
        created: data.createdAt,
      }
    } else if (host.name === 'netlify') {
      let data
      if (!activeDeployment) {
        data = await uploadFiles({
          endpoint: 'https://api.netlify.com/api/v1/sites',
          files
        })
        deployment = {
          id: data.site_id,
          deploy_id: data.id,
          url: data.ssl_url,
          created: Date.now(),
        }
      } else {
        data = await uploadFiles({
          endpoint: `https://api.netlify.com/api/v1/sites/${activeDeployment.id}/deploys`,
          files
        })
        deployment = {
          id: data.site_id,
          deploy_id: data.id,
          url: data.ssl_url,
          created: Date.now(),
        }
      }
      if (!data) {
        throw new Error('Error creating site')
      }
    }
  } catch(e) {
    console.error(e)
  }
  return deployment


  async function uploadFiles({ endpoint, files }) {
    const filesToUpload = chain(files.map(f => {
      var shasum = crypto.createHash('sha1')
      shasum.update(f.data)
      return ({ 
        hash: shasum.digest('hex'), 
        file: `/${f.file}`
      })
    }))
      .keyBy('file')
      .mapValues('hash')
      .value()

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
      .catch((e) => {
        console.log(e.toString())
        return ({ data: null })
      })

    // upload missing files
    if (res.data) {
      const {required, id} = res.data
      await Promise.all(
        required.map(async (hash) => {
          const fileName = Object.keys(filesToUpload).find(key => filesToUpload[key] === hash)
          const {data} = find(files, ['file', fileName.slice(1)])
          await axios.put(`https://api.netlify.com/api/v1/deploys/${id}/files${fileName}`, 
            data, 
            {
              headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${host.token}`
              }
          })
        })
      )
      return res.data
    }
  }
}

async function createSiteZip(files) {
  const zip = new JSZip()
  files.forEach((file) => {
    zip.file(file.path, file.content)
  })
  return await zip.generateAsync({ type: 'blob' })
}