import { json, error as server_error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import { PRIVATE_CLOUDFLARE_ACCOUNT_ID, PRIVATE_CLOUDFLARE_ZONE_ID, PRIVATE_CLOUDFLARE_HOSTNAMES_TOKEN } from '$env/static/private';
import axios from 'axios';
import authorize from '../../authorize'
import { debug } from '@anthropic-ai/sdk/core.mjs';

export const POST: RequestHandler = async (event) => {
  return authorize(event, {
    onsuccess: async ({ site_id, domain_name }) => {
      console.log({ domain_name })
      const { verification_details } = await setup_domain(domain_name)

      await supabase_admin
        .from('sites')
        .update({
          custom_domain: domain_name,
          verification_details
        })
        .match({ id: site_id });

      return json({ success: true, verification_details });
    },
    onerror: async () => {
      return json({ success: false, error: 'Could not add domain name' });
    }
  })
};

async function setup_domain(domain_name: string): Promise<{ verification_details: any }> {
  const cf_api = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: {
      'Authorization': `Bearer ${PRIVATE_CLOUDFLARE_HOSTNAMES_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const { data } = await supabase_admin
    .from('sites')
    .select('verification_details')
    .match({ custom_domain: domain_name });

  console.log({ data, domain_name })

  let verification_details = data

  if (!data) {
    // Step 1: Create custom hostname
    const hostname_response = await cf_api.post(`/zones/${PRIVATE_CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
      hostname: domain_name,
      ssl: {
        method: 'txt',
        type: 'dv'
      }
    }).catch(e => {
      console.log('ERROR Response:', e.response?.data)
      console.log('Attempted hostname:', domain_name)
      throw e
    })

    if (!hostname_response.data.success) {
      throw new Error(`Failed to create custom hostname: ${JSON.stringify(hostname_response.data.errors)}`);
    }

    console.log(hostname_response.data.result.ssl)
    verification_details = hostname_response.data.result.ssl.validation_records;
    await supabase_admin
      .from('sites')
      .update({
        verification_details
      })
      .match({ custom_domain: domain_name });
  }


  debugger



  // Step 2: Get verification details

  console.log({ verification_details })


  // Step 3: Add route to worker
  const route_response = await cf_api.post(`/accounts/${PRIVATE_CLOUDFLARE_ACCOUNT_ID}/workers/routes`, {
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

  return { verification_details };
}