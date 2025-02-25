import { json, error as server_error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import * as ENV_VARS from '$env/static/private';
import { S3Client, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";
import authorize from '../../authorize'

const s3_client = new S3Client({
  region: "auto",
  endpoint: `https://${ENV_VARS.PRIVATE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV_VARS.PRIVATE_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV_VARS.PRIVATE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true
});

export const POST: RequestHandler = async (event) => {
  return authorize(event, {
    onsuccess: async ({ site_id }) => {
      // Upload files to R2
      await copy_staging_to_live(site_id);

      await supabase_admin
        .from('sites')
        .update({ published: true })
        .match({ id: site_id });

      return json({ success: true, message: 'Deployment successful' });
    },
    onerror: async () => {
      return json({ success: false, error: 'Deployment failed' });
    }
  })
};

async function copy_staging_to_live(site_id: string): Promise<void> {

  const { data } = await supabase_admin
    .from('sites')
    .select('custom_domain')
    .match({ id: site_id })
    .single();

  const folder_name = data.custom_domain || site_id

  try {
    console.log(`Listing objects in staging folder for site ${folder_name}`);
    const list_command = new ListObjectsV2Command({
      Bucket: 'weave-sites',
      Prefix: `${folder_name}/staging/`,
    });

    const list_response = await s3_client.send(list_command);
    console.log('List response:', list_response);

    const staging_objects = list_response.Contents || [];

    const copy_commands = staging_objects.map(object => {
      if (!object.Key) return null;

      const source_key = object.Key;
      const destination_key = source_key.replace(`${folder_name}/staging/`, `${folder_name}/live/`);

      console.log({ destination_key })

      return new CopyObjectCommand({
        Bucket: 'weave-sites',
        CopySource: encodeURIComponent(`weave-sites/${source_key}`),
        Key: destination_key,
      });
    }).filter((command): command is CopyObjectCommand => command !== null);

    console.log(`Starting copy of ${copy_commands.length} files for site ${folder_name}`);
    const copy_results = await Promise.all(copy_commands.map(command => s3_client.send(command)));
    console.log(`Successfully copied ${copy_results.length} files from staging to live for site ${folder_name}`);
  } catch (error) {
    console.error(`Error in copy_staging_to_live for site ${folder_name}:`, error);
    throw new Error(`Failed to copy files from staging to live for site ${folder_name}`);
  }
}
