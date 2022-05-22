import axios from 'axios'
import JSZip from 'jszip'
import {Blob} from 'node:buffer';
globalThis.Blob = Blob;
JSZip.support.blob = true;


const blobToBinary = async (blob) => {
  const buffer = await blob.arrayBuffer();
  
  const view = new Int8Array(buffer);
  
  return [...view].map((n) => n.toString(2)).join(' ');
};

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
      // if deploymentID does not exists, create new site
  
      let data
      if (!activeDeployment) {
        const zipFile = await createSiteZip(files)
        const content = await blobToBinary(zipFile)
        const res = await axios
          .post('https://api.netlify.com/api/v1/sites', content, {
            headers: {
              'Content-Type': 'application/zip',
              Authorization: `Bearer ${host.token}`,
            },
          })
          .catch((e) => ({ data: null }))
  
        data = res.data
      } else {
        const zipFile = await createSiteZip(files)
        const res = await axios
          .put(
            `https://api.netlify.com/api/v1/sites/${activeDeployment}`,
            zipFile,
            {
              headers: {
                'Content-Type': 'application/zip',
                Authorization: `Bearer ${host.token}`,
              },
            }
          )
          .catch((e) => ({ data: null }))
  
        data = res.data
      }
  
      // check for null data before continuing if null then handle this error else continue
      if (!data) {
        throw new Error('Error creating site')
      } else {
        deployment = {
          id: data.deploy_id,
          url: `https://${data.subdomain}.netlify.app`,
          created: Date.now(),
        }
      }
    }
  } catch(e) {
    console.error(e)
  }
  return deployment
}

async function createSiteZip(files) {
  const zip = new JSZip()
  files.forEach((file) => {
    zip.file(file.path, file.content)
  })
  return await zip.generateAsync({ type: 'blob' })
}