import { json, error as server_error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import authorize from '../../authorize';
import * as ENV_VARS from '$env/static/private';

export const POST: RequestHandler = async (event) => {
  return authorize(event, {
    onsuccess: async ({ site_id }) => {
      // Upload files to R2
      await delete_folder(site_id);

      await supabase_admin
        .from('sites')
        .update({ published: true })
        .match({ id: site_id });

      return json({ success: true, message: 'Deployment successful' });
    },
    onerror: async () => {
      console.error('Error in deployment');
      return json({ success: false, error: 'Deployment failed' });
    }
  })
};

const s3_client = new S3Client({
  region: 'auto',
  endpoint: `https://${ENV_VARS.PRIVATE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV_VARS.PRIVATE_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV_VARS.PRIVATE_R2_SECRET_ACCESS_KEY,
  },
});

async function delete_folder(site_id: string) {

  const { data } = await supabase_admin
    .from('sites')
    .select('custom_domain')
    .match({ id: site_id })
    .single();

  const folder_name = data?.custom_domain || site_id

  const list_command = new ListObjectsV2Command({
    Bucket: 'weave-sites',
    Prefix: `${folder_name}/`,
  });

  const list_and_delete = async (continuation_token?: string) => {
    if (continuation_token) {
      list_command.input.ContinuationToken = continuation_token;
    }

    const list_response = await s3_client.send(list_command);

    if (list_response.Contents) {
      await Promise.all(list_response.Contents.map(async (object) => {
        if (object.Key) {
          const delete_command = new DeleteObjectCommand({
            Bucket: 'weave-sites',
            Key: object.Key,
          });
          await s3_client.send(delete_command);
        }
      }));
    }

    if (list_response.IsTruncated) {
      await list_and_delete(list_response.NextContinuationToken);
    }
  };

  await list_and_delete();
}
