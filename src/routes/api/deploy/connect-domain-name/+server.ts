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

export const POST: RequestHandler = async (event) => {

  return authorize(event, {
    onsuccess: async ({ site_id, domain_name }) => {

      // await rename_r2_folder(site_id, domain_name);
      // return json({ success: true, message: 'Domain successfully connected to site and folder renamed' });

      // First, get the zone ID for the domain
      const zone_id = await get_domain_zone_id(domain_name)

      // Now, check the activation status of the zone
      const status = await get_zone_status(zone_id)

      if (status === 'active') {
        // Connect the domain to the worker
        const domain_connected = await connect_domain_to_worker(domain_name, zone_id)

        if (domain_connected) {
          // Rename folder in R2 bucket
          await rename_r2_folder(site_id, domain_name);

          // Update the site record with the new folder name and custom domain status
          await supabase_admin
            .from('sites')
            .update({
              custom_domain_connected: true
            })
            .match({ id: site_id });

          return json({ success: true, message: 'Domain successfully connected to site and folder renamed' });
        } else {
          return json({ success: false, message: 'Failed to connect domain to site' });
        }
      } else {
        return json({ success: false, message: 'Domain is not active yet. Please wait for nameservers to propagate.', status });
      }
    },
    onerror: async () => {
      console.error('Error connecting domain to worker');
      return json({ success: false, error: 'Failed to connect domain to worker or rename folder' });
    }
  })
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
        CopySource: `${ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET}/${old_key}`,
        Key: new_key,
      });

      await s3_client.send(copy_command);

      const delete_command = new DeleteObjectCommand({
        Bucket: ENV_VARS.PRIVATE_CLOUDFLARE_SITES_BUCKET,
        Key: old_key,
      });

      await s3_client.send(delete_command);
    }));
  }));
}

async function get_domain_zone_id(domain_name) {
  const zones_response = await axios.get(
    `https://api.cloudflare.com/client/v4/zones?name=${domain_name}`,
    {
      headers: {
        'Authorization': `Bearer ${ENV_VARS.PRIVATE_CLOUDFLARE_ZONE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!zones_response.data.success || zones_response.data.result.length === 0) {
    return json({ success: false, message: 'Domain not found in Cloudflare' });
  }

  const zone_id = zones_response.data.result[0].id;
  return zone_id
}

async function get_zone_status(zone_id) {
  const status_response = await axios.get(
    `https://api.cloudflare.com/client/v4/zones/${zone_id}`,
    {
      headers: {
        'Authorization': `Bearer ${ENV_VARS.PRIVATE_CLOUDFLARE_ZONE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!status_response.data.success) {
    return json({ success: false, message: 'Failed to check zone status' });
  }

  const status = status_response.data.result.status;
  return status
}

async function connect_domain_to_worker(domain_name, zone_id) {
  const { data } = await axios.put(
    `https://api.cloudflare.com/client/v4/accounts/${ENV_VARS.PRIVATE_CLOUDFLARE_ACCOUNT_ID}/workers/domains`,
    {
      zone_id,
      hostname: domain_name,
      service: ENV_VARS.PRIVATE_CLOUDFLARE_WORKER_NAME,
      environment: 'production'
    },
    {
      headers: {
        'Authorization': `Bearer ${ENV_VARS.PRIVATE_CLOUDFLARE_WORKERS_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return data.success;
}
