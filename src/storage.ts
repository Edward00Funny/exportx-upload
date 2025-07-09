import { Context } from 'hono';
import { HeadObjectCommand, S3, S3ClientConfig } from '@aws-sdk/client-s3';
import { env } from 'hono/adapter'
import { type Bindings, BucketConfig } from './bindings';
import to from 'await-to-js';
import { customAlphabet } from 'nanoid';

// compatible file interface, applicable to Cloudflare Workers and Node.js environment
export interface CompatibleFile {
  name: string;
  type: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

// R2Bucket types are provided by Cloudflare Workers runtime
declare global {
  interface R2Bucket {
    head(key: string): Promise<R2Object | null>;
    put(key: string, value: ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object>;
  }

  interface R2Object {
    key: string;
    size: number;
    etag: string;
  }

  interface R2PutOptions {
    httpMetadata?: {
      contentType?: string;
      contentLanguage?: string;
      contentDisposition?: string;
      contentEncoding?: string;
      cacheControl?: string;
      cacheExpiry?: Date;
    };
  }
}

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 21);

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 1) { // Handles no extension and leading dot like .env
    return '';
  }
  return filename.substring(lastDot);
}

function generateUniqueFileName(originalName: string): string {
  const extension = getFileExtension(originalName);
  return `${nanoid()}${extension}`;
}

export type UploadResult = {
  url: string;
  fileName: string;
};

export type UploadOptions = {
  path: string;
  fileName?: string;
  overwrite?: boolean;
};

function sanitizePath(path: string): string {
  // Remove leading/trailing slashes and normalize multiple slashes
  let cleaned = path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');

  // Handle directory traversal by resolving path segments
  const segments = cleaned.split('/');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      // Go up one directory (remove last segment)
      resolved.pop();
    } else if (segment !== '.' && segment !== '') {
      // Add valid segments (ignore current directory and empty segments)
      resolved.push(segment);
    }
  }

  return resolved.join('/');
}

/**
 * Validate if the path is allowed
 */
function validatePath(requestedPath: string, allowedPaths: string[]): boolean {
  // If all paths are allowed
  if (allowedPaths.includes('*')) {
    return true;
  }

  // Clean the requested path
  const cleanPath = sanitizePath(requestedPath);

  // If no path (root directory upload), check if empty path is allowed
  if (!cleanPath) {
    return allowedPaths.includes('') || allowedPaths.includes('/');
  }

  // Check if the path is in the allowed paths
  return allowedPaths.some(allowedPath => {
    const cleanAllowedPath = sanitizePath(allowedPath);

    // Exact match
    if (cleanPath === cleanAllowedPath) {
      return true;
    }

    // Check if requested path is a subpath of allowed path
    if (cleanPath.startsWith(cleanAllowedPath + '/')) {
      return true;
    }

    return false;
  });
}

/**
 * validate bucket and user permission
 */
export function validateBucketAccess<E extends { Bindings: Bindings }>(
  c: Context<E>,
  bucketId: string,
  userId?: string
): { isValid: boolean; error?: string; bucketConfig?: BucketConfig } {
  let bucketConfig: BucketConfig;

  try {
    bucketConfig = getBucketConfig(c, bucketId);
  } catch (error: any) {
    console.error(`Failed to get config for bucket '${bucketId}':`, error.message);
    return {
      isValid: false,
      error: 'Configuration error for the specified bucket.'
    };
  }

  // check bucket's ID whitelist
  if (!bucketConfig.idWhitelist || bucketConfig.idWhitelist.length === 0) {
    console.error(`ID whitelist is required for bucket '${bucketId}'`);
    return {
      isValid: false,
      error: 'Service unavailable: ID whitelist not configured for this bucket.'
    };
  }

  if (!userId) {
    return {
      isValid: false,
      error: 'Unauthorized: User ID required for whitelist validation.'
    };
  }

  if (!bucketConfig.idWhitelist.includes(userId)) {
    return {
      isValid: false,
      error: 'Unauthorized: User ID not in whitelist for this bucket.'
    };
  }

  return { isValid: true, bucketConfig };
}

/**
 * Get bucket configuration from JSON configuration
 */
export function getBucketConfig<E extends { Bindings: Bindings }>(c: Context<E>, bucketId: string): BucketConfig {
  const envVars = env(c);

  // 获取JSON配置
  const bucketsConfigJson = envVars.BUCKET_CONFIGS;
  if (!bucketsConfigJson) {
    throw new Error('BUCKET_CONFIGS environment variable not found. Please configure your buckets in JSON format.');
  }

  let bucketConfigs: BucketConfig[];
  try {
    bucketConfigs = JSON.parse(bucketsConfigJson);
  } catch (error) {
    throw new Error('Invalid JSON in BUCKET_CONFIGS environment variable.');
  }

  // 查找指定的bucket配置
  const config = bucketConfigs.find((bucket: BucketConfig) => bucket.id === bucketId);
  if (!config) {
    throw new Error(`Bucket configuration with id '${bucketId}' not found.`);
  }

  // 验证配置完整性
  if (config.provider === 'AWS_S3') {
    if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new Error(`S3 bucket configuration '${bucketId}' is incomplete. Required: accessKeyId, secretAccessKey, bucketName`);
    }
    if (!config.endpoint || !config.region) {
      throw new Error(`S3 bucket configuration '${bucketId}' is incomplete. Required: endpoint, region`);
    }
  } else if (config.provider === 'CLOUDFLARE_R2') {
    if (!config.bindingName) {
      throw new Error(`R2 bucket configuration '${bucketId}' is incomplete. Required: bindingName`);
    }
  }

  // 设置默认值
  return {
    ...config,
    allowedPaths: config.allowedPaths || ['*'],
    idWhitelist: config.idWhitelist || undefined
  };
}

async function checkR2FileExists(r2Bucket: R2Bucket, key: string): Promise<boolean> {
  const object = await r2Bucket.head(key);
  return object !== null;
}

async function checkS3FileExists(s3Client: S3, bucket: string, key: string): Promise<boolean> {
  const [err] = await to(
    s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  );
  // If err is null, the object exists. If there's a 'NotFound' error, it doesn't.
  return err === null;
}

async function uploadToR2<E extends { Bindings: Bindings }>(c: Context<E>, file: CompatibleFile, config: BucketConfig, options: UploadOptions): Promise<UploadResult> {
  if (!config.bindingName) {
    throw new Error('R2 configuration error: missing bindingName');
  }

  // Get R2 bucket binding
  const r2Bucket = c.env[config.bindingName] as R2Bucket;
  if (!r2Bucket) {
    throw new Error(`R2 bucket binding '${config.bindingName}' not found. Please check r2_buckets configuration in wrangler.jsonc.`);
  }

  const path = options.path ? sanitizePath(options.path) : '';
  const fileName = options.fileName || generateUniqueFileName(file.name);
  const fileKey = path ? `${path}/${fileName}` : fileName;

  if (!options.overwrite) {
    const exists = await checkR2FileExists(r2Bucket, fileKey);
    if (exists) {
      throw new Error(`File '${fileKey}' already exists. Use overwrite option to replace it.`);
    }
  }

  const [err] = await to(
    r2Bucket.put(fileKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
  );

  if (err) {
    throw new Error('Upload to R2 failed: ' + err.message);
  }

  // Generate access URL
  let url: string;
  if (config.customDomain) {
    url = `${config.customDomain}/${fileKey}`;
  } else {
    url = `${config.endpoint}/${fileKey}`; // Default path
  }

  return { url, fileName };
}

async function uploadToS3<E extends { Bindings: Bindings }>(c: Context<E>, file: CompatibleFile, config: BucketConfig, options: UploadOptions): Promise<UploadResult> {
  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName || !config.endpoint || !config.region) {
    throw new Error('S3 configuration incomplete');
  }

  const s3ClientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  // Set custom endpoint (for Cloudflare R2 via S3 API or other S3-compatible services)
  if (config.endpoint) {
    s3ClientConfig.endpoint = config.endpoint;
  }

  const s3Client = new S3(s3ClientConfig);

  const path = options.path ? sanitizePath(options.path) : '';
  const fileName = options.fileName || generateUniqueFileName(file.name);
  const fileKey = path ? `${path}/${fileName}` : fileName;

  if (!options.overwrite) {
    const exists = await checkS3FileExists(s3Client, config.bucketName, fileKey);
    if (exists) {
      throw new Error(`File '${fileKey}' already exists. Use overwrite option to replace it.`);
    }
  }

  const [err] = await to(
    s3Client.putObject({
      Bucket: config.bucketName,
      Key: fileKey,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );

  if (err) {
    throw new Error('Upload to S3 failed: ' + err.message);
  }

  // Generate access URL
  let url: string;
  if (config.customDomain) {
    url = `${config.customDomain}/${fileKey}`;
  } else {
    // Use S3 default URL format
    url = `${config.endpoint}/${config.bucketName}/${fileKey}`;
  }

  return { url, fileName };
}

/**
 * Get all bucket configurations (excluding sensitive data)
 */
export function getAllBucketsConfig<E extends { Bindings: Bindings }>(c: Context<E>): Record<string, BucketConfig> {
  const envVars = env(c);
  const buckets: Record<string, BucketConfig> = {};

  // 获取JSON配置
  const bucketsConfigJson = envVars.BUCKET_CONFIGS;
  if (!bucketsConfigJson) {
    console.warn('BUCKET_CONFIGS environment variable not found.');
    return buckets;
  }

  try {
    const bucketConfigs: BucketConfig[] = JSON.parse(bucketsConfigJson);

    bucketConfigs.forEach(config => {
      if (config.id) {
        // 移除敏感信息
        const publicConfig = { ...config };
        delete publicConfig.accessKeyId;
        delete publicConfig.secretAccessKey;

        buckets[config.id] = publicConfig;
      }
    });
  } catch (error) {
    console.warn('Invalid JSON in BUCKET_CONFIGS environment variable.');
  }

  return buckets;
}

/**
 * Upload file to the specified storage
 */
export async function uploadFile<E extends { Bindings: Bindings }>(c: Context<E>, file: CompatibleFile, options: UploadOptions, config: BucketConfig): Promise<UploadResult> {
  // Validate path against allowed paths in the bucket config
  if (!validatePath(options.path, config.allowedPaths || ['*'])) {
    throw new Error(`Path '${options.path}' is not allowed for this bucket.`);
  }

  // Choose upload strategy based on provider
  if (config.provider === 'CLOUDFLARE_R2') {
    return await uploadToR2(c, file, config, options);
  } else if (config.provider === 'AWS_S3') {
    return await uploadToS3(c, file, config, options);
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }
} 