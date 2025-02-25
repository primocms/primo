import { json, error as server_error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin';
import * as ENV_VARS from '$env/static/private';
import { S3Client, PutObjectCommand, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";
import authorize from '../../authorize'

const s3_client = new S3Client({
  region: "auto",
  endpoint: `https://${ENV_VARS.PRIVATE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV_VARS.PRIVATE_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV_VARS.PRIVATE_R2_SECRET_ACCESS_KEY,
  },
});

interface DeploymentFile {
  path: string;
  content: string | Buffer;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const { site_id, files } = await request.json();
  console.log({ site_id })
  try {
    const session = await locals.getSession();
    console.log({ session })
    if (!session) {
      throw server_error(401, { message: 'Unauthorized' });
    }
    // Upload files to R2
    await upload_files(site_id, files);
    await copy_staging_to_live(site_id);

    await supabase_admin
      .from('sites')
      .update({ published: true })
      .match({ id: site_id });

    return json({ success: true });
  } catch (e) {
    console.error(e)
    return json({ success: false, message: 'Unauthorized' });
  }


};

async function upload_files(site_id: string, files: DeploymentFile[]): Promise<void> {
  const { data } = await supabase_admin
    .from('sites')
    .select('custom_domain')
    .match({ id: site_id })
    .single();

  const folder_name = data?.custom_domain || site_id

  const commands = files.map(file => {
    const file_path = `${folder_name}/staging/${file.path}`;
    let content_type = 'application/octet-stream';
    if (file.path.endsWith('.html')) content_type = 'text/html; charset=utf-8';
    if (file.path.endsWith('.css')) content_type = 'text/css; charset=utf-8';
    if (file.path.endsWith('.js')) content_type = 'application/javascript; charset=utf-8';
    if (file.path.endsWith('.json')) content_type = 'application/json; charset=utf-8';

    return new PutObjectCommand({
      Bucket: 'weave-sites',
      Key: file_path,
      Body: file.content,
      ContentType: content_type,
    });
  });

  try {
    console.log(`Starting upload of ${files.length} files for site ${site_id}`);
    const results = await Promise.all(commands.map(command => s3_client.send(command)));
    console.log(`Successfully uploaded ${results.length} files for site ${site_id}`);
  } catch (error) {
    console.error(`Error uploading files for site ${site_id}:`, error);
    throw new Error(`Failed to upload files for site ${site_id}`);
  }
}

async function copy_staging_to_live(site_id: string): Promise<void> {

  const { data } = await supabase_admin
    .from('sites')
    .select('custom_domain')
    .match({ id: site_id })
    .single();

  const folder_name = data?.custom_domain || site_id

  try {
    console.log(`Listing objects in staging folder for site ${site_id}`);
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

      return new CopyObjectCommand({
        Bucket: 'weave-sites',
        CopySource: `weave-sites/${source_key}`,
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
