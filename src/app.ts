import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import type { Bindings } from './bindings'
import { authMiddleware } from './auth'
import { uploadFile, UploadOptions, getAllBucketsConfig } from './storage'

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
  try {
    const allBucketsConfig = getAllBucketsConfig(c);
    let filteredBuckets = allBucketsConfig;

    const userId = c.req.header('X-User-Id');
    if (!userId) {
      // If user id is required but not provided, return no buckets
      filteredBuckets = {};
    } else {
      filteredBuckets = Object.entries(allBucketsConfig).reduce((acc, [bucketName, config]) => {
        // A bucket is only accessible if it has a whitelist and the user is in it.
        if (config.idWhitelist && config.idWhitelist.includes(userId)) {
          acc[bucketName] = config;
        }
        return acc;
      }, {} as Record<string, typeof allBucketsConfig[string]>);
    }

    // Build public configuration information, hiding sensitive data
    const publicConfig = Object.entries(filteredBuckets).map(([bucketName, config]) => ({
      name: bucketName,
      provider: config.provider,
      bucketName: config.bucketName,
      region: config.region,
      endpoint: config.endpoint?.replace(/\/+$/, ''), // Remove trailing slashes
      customDomain: config.customDomain?.replace(/\/+$/, ''), // Remove trailing slashes
      bindingName: config.bindingName,
      alias: config.alias || bucketName, // Use alias or bucket name
      allowedPaths: config.allowedPaths || ['*'], // Return allowed paths
      // Do not return sensitive information like accessKeyId and secretAccessKey
    }));

    return c.json({
      success: true,
      buckets: publicConfig,
    });
  } catch (error: any) {
    console.error('Failed to get bucket configuration:', error.message);
    return c.json({
      success: false,
      error: 'Failed to get bucket configuration',
      message: error.message
    }, 500);
  }
})

// Upload validation schema
const uploadSchema = z.object({
  path: z.string().min(1, 'path is required'),
  fileName: z.string().optional(),
  overwrite: z.preprocess((val) => val === 'true', z.boolean()).optional(),
  bucket: z.string().min(1, 'bucket is required'),
  file: z.any().refine((file) => file instanceof File, 'file must be a valid File object'),
});

// Upload route
app.post(
  '/upload',
  authMiddleware,
  async (c) => {
    try {
      const bucketConfig = c.get('bucketConfig');
      if (!bucketConfig) {
        return c.json({ success: false, error: 'Bucket configuration not found in context.' }, 500);
      }

      // Parse form data first
      const formData = await c.req.parseBody();

      // Prepare data for zod validation
      const uploadData = {
        path: formData.path,
        fileName: formData.fileName,
        overwrite: formData.overwrite,
        bucket: formData.bucket,
        file: formData.file,
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

      const { path, fileName, overwrite, file } = validationResult.data;
      const options: UploadOptions = {
        path,
        fileName,
        overwrite,
      };

      const result = await uploadFile(c, file, options, bucketConfig)
      return c.json(result)
    } catch (error: any) {
      console.error('Upload failed:', error.message)
      return c.json({
        success: false,
        error: 'Upload failed',
        message: error.message
      }, 500)
    }
  })

export { app }  