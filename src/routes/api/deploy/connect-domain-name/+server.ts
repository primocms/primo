import { json, error as server_error } from '@sveltejs/kit';
import authorize from '../../authorize'
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import * as ENV_VARS from '$env/static/private';
import axios from 'axios';
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3_client = new S3Client({
  region: "auto",
  endpoint: `https://${ENV_VARS.PRIVATE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV_VARS.PRIVATE_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV_VARS.PRIVATE_R2_SECRET_ACCESS_KEY,
  },
});

const cf_api = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: {
    'Authorization': `Bearer ${ENV_VARS.PRIVATE_CLOUDFLARE_ZONE_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const POST: RequestHandler = async (event) => {

  return authorize(event, {
    onsuccess: async ({ site_id, domain_name }) => {

      const { data } = await supabase_admin
        .from('sites')
        .select('custom_hostname_id, ssl_validation')
        .match({ id: site_id })
        .single()

      if (!data?.custom_hostname_id) {
        throw Error('No custom hostname stored')
      }

      const result = await add_custom_hostname(data.custom_hostname_id)

      // store ssl validation record if not already stored
      const ssl_validation_record = result.ssl.validation_records?.[0]
      if (!data.ssl_validation) {
        await supabase_admin
          .from('sites')
          .update({ ssl_validation: ssl_validation_record })
          .eq('id', site_id)
      }

      const dns_record_completions = {
        cname: !result.verification_errors,
        ssl: result.ssl.status !== 'pending_validation',
        verification: result.status === 'active'
      }
      await supabase_admin
        .from('sites')
        .update({ dns_records: dns_record_completions })
        .eq('id', site_id)

      const completed = dns_record_completions.cname && dns_record_completions.ssl && dns_record_completions.verification

      if (completed) {
        await rename_r2_folder(site_id, domain_name)
        await supabase_admin.from('sites').update({ custom_domain_connected: true }).eq('id', site_id)
      }
      console.log(result)

      return json({
        success: completed,
        dns_record_completions,
        result,
        ...ssl_validation_record ? { ssl_validation_record } : {}
      })
    },
    onerror: async () => {
      console.error('Error connecting domain to worker');
      return json({ success: false, error: 'Failed to connect domain to worker or rename folder' });
    }
  })
}

async function add_custom_hostname(custom_hostname_id) {
  const { data } = await cf_api.get(`/zones/${ENV_VARS.PRIVATE_CLOUDFLARE_ZONE_ID}/custom_hostnames/${custom_hostname_id}`).catch(e => {
    console.log('Worker Route ERROR:', e.response?.data)
    // console.log('Attempted pattern:', `${domain_name}/*`)
    throw e
  });
  return data.result
}

async function rename_r2_folder(old_folder_name, new_folder_name) {
  const environments = ['staging', 'live'];

  await Promise.all(environments.map(async (env) => {
    const list_command = new ListObjectsV2Command({
      Bucket: ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET,
      Prefix: `${old_folder_name}/${env}/`,
    });

    const list_result = await s3_client.send(list_command);

    await Promise.all((list_result.Contents || []).map(async (object) => {
      const old_key = object.Key;
      const new_key = old_key.replace(`${old_folder_name}/${env}`, `${new_folder_name}/${env}`);

      const copy_command = new CopyObjectCommand({
        Bucket: ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET,
        CopySource: encodeURIComponent(`${ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET}/${old_key}`),
        Key: new_key,
      });

      await s3_client.send(copy_command);

      // TODO: 
      // Temporarily don't delete old folder so image references still work. 
      // In the future, change image urls to match new site, or have them match '/_assets/image.jpg' instead of 'cdn.weavecms.siteß'

      // const delete_command = new DeleteObjectCommand({
      //   Bucket: ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET,
      //   Key: old_key,
      // });

      // await s3_client.send(delete_command);
    }));
  }));
}
