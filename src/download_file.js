import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createWriteStream } from 'fs'
import { PRIVATE_AWS_KEY_ID, PRIVATE_AWS_KEY } from '$env/static/private'

const downloaded_file_name = 'downloaded-file.txt'

const s3_client = new S3Client({
	region: 'us-east-1',
	credentials: {
		accessKeyId: PRIVATE_AWS_KEY_ID,
		secretAccessKey: PRIVATE_AWS_KEY
	}
})

// Function to download a file from an S3 bucket
export async function download_file(bucket_name, object_key) {
	const get_object_params = {
		Bucket: bucket_name,
		Key: object_key
	}

	try {
		const command = new GetObjectCommand(get_object_params)
		const res = await s3_client.send(command)

		let file_content_as_string = ''
		for await (const chunk of res.Body) {
			file_content_as_string += chunk
		}

		return {
			type: res.ContentType,
			body: file_content_as_string
		} // Returns the content of the file as a string
	} catch (error) {
		console.error('Error downloading file content:', error)
		return null
	}
}
