import { json, error as server_error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import { PRIVATE_CLOUDFLARE_WORKERS_API_TOKEN, PRIVATE_CLOUDFLARE_ZONE_ID, PRIVATE_CLOUDFLARE_HOSTNAMES_TOKEN } from '$env/static/private';
import axios from 'axios';
import authorize from '../../authorize'
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  apiToken: PRIVATE_CLOUDFLARE_HOSTNAMES_TOKEN
});

const cf_api = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: {
    'Authorization': `Bearer ${PRIVATE_CLOUDFLARE_WORKERS_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const POST: RequestHandler = async (event) => {
  return authorize(event, {
    onsuccess: async ({ site_id, domain_name }) => {
      console.log({ domain_name })
      const ownership_verification = await setup_domain(domain_name, site_id)

      console.log({ ownership_verification });

      return json({ success: true, ownership_verification });
    },
    onerror: async () => {
      return json({ success: false, error: 'Could not add domain name' });
    }
  })
};

async function setup_domain(domain_name: string, site_id: string) {
  // Step 1: Create the Custom Hostname
  const { id, ownership_verification } = await client.customHostnames.create({
    zone_id: PRIVATE_CLOUDFLARE_ZONE_ID,
    hostname: domain_name,
    ssl: {
      method: 'txt',
      type: 'dv'
    },
  });

  // Step 2: Save the Custom Hostname ID and verification JSON
  await supabase_admin
    .from('sites')
    .update({
      custom_domain: domain_name,
      ownership_verification,
      custom_hostname_id: id
    })
    .match({ id: site_id });

  // Step 3: Add route to worker
  const route_response = await cf_api.post(`/zones/${PRIVATE_CLOUDFLARE_ZONE_ID}/workers/routes`, {
    pattern: `${domain_name}/*`,
    script: "primo-worker"
  }).catch(e => {
    console.log('Worker Route ERROR:', e.response?.data)
    console.log('Attempted pattern:', `${domain_name}/*`)
    throw e
  });

  if (!route_response.data.success) {
    throw new Error(`Failed to create worker route: ${JSON.stringify(route_response.data.errors)}`);
  }

  console.log(`Custom hostname ${domain_name} created. Verification needed.`);

  return ownership_verification
}
