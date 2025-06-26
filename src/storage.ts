import { Context } from 'hono';
import { HeadObjectCommand, S3, S3ClientConfig } from '@aws-sdk/client-s3';
import { Bindings } from './bindings';
import to from 'await-to-js';

export type UploadResult = {
  url: string;
  fileName: string;
};

export type UploadOptions = {
  path?: string;
  fileName?: string;
  overwrite?: boolean;
};

function sanitizePath(path: string): string {
  // Remove leading/trailing slashes and prevent directory traversal
  return path.replace(/^\/+|\/+$/g, '').replace(/\.\.\//g, '');
}

async function checkR2FileExists(c: Context<{ Bindings: Bindings }>, key: string): Promise<boolean> {
  if (!c.env.R2_BUCKET) return false;
  const object = await c.env.R2_BUCKET.head(key);
  return object !== null;
}

async function checkS3FileExists(s3Client: S3, bucket: string, key: string): Promise<boolean> {
  const [err] = await to(
    s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  );
  // If err is null, the object exists. If there's a 'NotFound' error, it doesn't.
  return err === null;
}

async function uploadToR2(c: Context<{ Bindings: Bindings }>, file: File, options: UploadOptions): Promise<UploadResult> {
  if (!c.env.R2_BUCKET) {
    throw new Error('R2_BUCKET is not configured in the environment.');
  }

  const path = options.path ? sanitizePath(options.path) : '';
  const fileName = options.fileName || `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
  const fileKey = path ? `${path}/${fileName}` : fileName;

  if (!options.overwrite) {
    const exists = await checkR2FileExists(c, fileKey);
    if (exists) {
      throw new Error(`File '${fileKey}' already exists. Use overwrite option to replace it.`);
    }
  }

  const [err] = await to(
    c.env.R2_BUCKET.put(fileKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
  );

  if (err) {
    throw new Error('Failed to upload to R2: ' + err.message);
  }

  const baseUrl = c.env.CUSTOM_DOMAIN || '';
  const url = baseUrl ? `${baseUrl}/${fileKey}` : `/files/${fileKey}`; // Adjusted for custom domain
  return { url, fileName: file.name };
}

async function uploadToS3(c: Context<{ Bindings: Bindings }>, file: File, options: UploadOptions): Promise<UploadResult> {
  // Use new environment variable names first, fallback to legacy names
  const accessKeyId = c.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = c.env.S3_SECRET_ACCESS_KEY;
  const bucketName = c.env.S3_BUCKET_NAME;
  const endpoint = c.env.S3_ENDPOINT;
  const region = c.env.S3_REGION;

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('S3 environment variables (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME) are not fully configured.');
  }
  if (!endpoint || !region) {
    throw new Error('S3_ENDPOINT or S3_REGION is not configured in the environment.');
  }

  const s3ClientConfig: S3ClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  // If custom endpoint is provided (e.g., for Cloudflare R2 via S3 API)
  if (endpoint) {
    s3ClientConfig.endpoint = endpoint;
    // s3ClientConfig.forcePathStyle = true;
  }

  const s3Client = new S3(s3ClientConfig);

  const path = options.path ? sanitizePath(options.path) : '';
  const fileName = options.fileName || `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
  const fileKey = path ? `${path}/${fileName}` : fileName;

  if (!options.overwrite) {
    const exists = await checkS3FileExists(s3Client, bucketName, fileKey);
    if (exists) {
      throw new Error(`File '${fileKey}' already exists. Use overwrite option to replace it.`);
    }
  }

  const [err] = await to(
    s3Client.putObject({
      Bucket: bucketName,
      Key: fileKey,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );

  if (err) {
    throw new Error('Failed to upload to S3: ' + err.message);
  }

  // Generate URL based on custom domain or default S3 URL
  let url: string;
  const s3Host = endpoint || `https://s3.${region}.amazonaws.com`;
  if (c.env.CUSTOM_DOMAIN) {
    url = `${c.env.CUSTOM_DOMAIN}/${fileKey}`;
  } else {
    // For custom endpoints like Cloudflare R2 or other S3-compatible services
    url = `${s3Host}/${bucketName}/${fileKey}`;
  }

  return { url, fileName: file.name };
}

export async function uploadFile(c: Context<{ Bindings: Bindings }>, file: File, options: UploadOptions): Promise<UploadResult> {
  const provider = c.env.STORAGE_PROVIDER?.toUpperCase();
  switch (provider) {
    case 'CLOUDFLARE_R2':
      return uploadToR2(c, file, options);
    case 'AWS_S3':
      return uploadToS3(c, file, options);
    default:
      throw new Error(`Invalid or no STORAGE_PROVIDER configured. Set it to 'CLOUDFLARE_R2' or 'AWS_S3'.`);
  }
} 