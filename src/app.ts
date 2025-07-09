import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { to } from 'await-to-js'
import type { Bindings } from './bindings'
import { authMiddleware } from './auth'
import { uploadFile, UploadOptions, getAllBucketsConfig, validateBucketAccess } from './storage'

const app = new Hono<{ Bindings: Bindings }>()

// Configure CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}))

// Health check route
app.get('/', (c) => {
  return c.text('OK')
})

// Get bucket configurations route
app.get('/buckets', authMiddleware, async (c) => {
  const allBucketsConfig = getAllBucketsConfig(c);
  let filteredBuckets = allBucketsConfig;

  const userId = c.req.header('X-User-Id');
  if (!userId) {
    // If user id is required but not provided, return no buckets
    filteredBuckets = {};
  } else {
    filteredBuckets = Object.entries(allBucketsConfig).reduce((acc, [bucketId, config]) => {
      // A bucket is only accessible if it has a whitelist and the user is in it.
      if (config.idWhitelist && config.idWhitelist.includes(userId)) {
        acc[bucketId] = config;
      }
      return acc;
    }, {} as Record<string, typeof allBucketsConfig[string]>);
  }

  // Build public configuration information, hiding sensitive data
  const publicConfig = Object.entries(filteredBuckets).map(([bucketId, config]) => ({
    id: bucketId,
    name: config.name || config.bucketName, // Use name, fallback to alias, then id
    provider: config.provider,
    bucketName: config.bucketName,
    region: config.region,
    endpoint: config.endpoint?.replace(/\/+$/, ''), // Remove trailing slashes
    customDomain: config.customDomain?.replace(/\/+$/, ''), // Remove trailing slashes
    bindingName: config.bindingName,
    allowedPaths: config.allowedPaths || ['*'], // Return allowed paths
    // Do not return sensitive information like accessKeyId and secretAccessKey
  }));

  return c.json({
    success: true,
    buckets: publicConfig,
  });
})

// Upload validation schema
const uploadSchema = z.object({
  path: z.string().min(1, 'path is required'),
  fileName: z.string().optional(),
  overwrite: z.preprocess((val) => val === 'true', z.boolean()).optional(),
  bucket: z.string().min(1, 'bucket is required'),
});

// Upload route
app.post(
  '/upload',
  authMiddleware,
  async (c) => {
    // Parse form data first
    const [parseErr, formData] = await to(c.req.parseBody());

    if (parseErr) {
      console.error('Failed to parse form data:', parseErr.message)
      return c.json({
        success: false,
        error: 'Failed to parse form data',
        message: parseErr.message
      }, 400)
    }

    // Prepare data for zod validation
    const uploadData = {
      path: formData.path,
      fileName: formData.fileName,
      overwrite: formData.overwrite,
      bucket: formData.bucket,
    };

    // Validate with zod
    const validationResult = uploadSchema.safeParse(uploadData);

    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: validationResult.error.flatten(),
      }, 400);
    }

    const { path, fileName, overwrite, bucket } = validationResult.data;

    // validate bucket and user permission
    const userId = c.req.header('X-User-Id');
    const bucketValidation = validateBucketAccess(c, bucket, userId);

    if (!bucketValidation.isValid) {
      const statusCode = bucketValidation.error?.includes('not configured') ? 503 :
        bucketValidation.error?.includes('not in whitelist') ? 403 : 401;
      return c.json({ error: bucketValidation.error }, statusCode);
    }

    const bucketConfig = bucketValidation.bucketConfig!;
    const options: UploadOptions = {
      path,
      fileName,
      overwrite,
    };

    const file = formData.file;
    if (!file || typeof file !== 'object' || !('name' in file) || !('type' in file) || typeof file.arrayBuffer !== 'function') {
      return c.json({
        success: false,
        error: 'File not found or invalid',
      }, 400);
    }

    const [uploadErr, result] = await to(uploadFile(c, file, options, bucketConfig));

    if (uploadErr) {
      console.error('Upload failed:', uploadErr.message)
      return c.json({
        success: false,
        error: 'Upload failed',
        message: uploadErr.message
      }, 500)
    }
    return c.json(result)
  })

export { app }  