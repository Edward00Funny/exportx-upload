import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from 'hono/adapter'
import type { Bindings } from './bindings'
import { authMiddleware } from './auth'
import { uploadFile, UploadOptions, getAllBucketsConfig } from './storage'

const app = new Hono<{ Bindings: Bindings }>()

// Configure CORS middleware based on ALLOWED_ORIGINS
app.use('*', (c, next) => {
  const { ALLOWED_ORIGINS } = env(c)
  const allowedOrigins = ALLOWED_ORIGINS || '*';
  const origins = allowedOrigins === '*' ? '*' : allowedOrigins.split(',').map(origin => origin.trim());

  return cors({
    origin: origins,
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Email'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })(c, next);
})

// Health check route
app.get('/', (c) => {
  return c.text('OK')
})

// Get bucket configurations route
app.get('/buckets', authMiddleware, async (c) => {
  try {
    const bucketsConfig = getAllBucketsConfig(c);

    // Build public configuration information, hiding sensitive data
    const publicConfig = Object.entries(bucketsConfig).map(([bucketName, config]) => ({
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
      defaultBucket: c.env.DEFAULT_BUCKET_CONFIG_NAME
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

// Upload route
app.post('/upload', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as unknown as File
    const path = formData.get('path')?.toString();
    const fileName = formData.get('fileName')?.toString();
    const overwrite = formData.get('overwrite')?.toString() === 'true';
    const bucket = formData.get('bucket')?.toString(); // Get bucket logical name from form data

    if (!file || typeof file.arrayBuffer !== 'function') {
      return c.json({ error: 'No file provided or form data is incorrect.' }, 400)
    }
    if (!bucket) {
      return c.json({ success: false, error: 'bucket is required.' }, 400);
    }
    if (!path) {
      return c.json({ success: false, error: 'path is required.' }, 400);
    }

    const options: UploadOptions = {
      path,
      fileName,
      overwrite,
      bucket, // Add bucket parameter to options
    };

    const result = await uploadFile(c, file, options)
    return c.json(result)
  } catch (error: any) {
    console.error('Upload failed:', error.message)
    return c.json({ error: 'Upload failed', message: error.message }, 500)
  }
})

export { app } 