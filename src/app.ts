import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from 'hono/adapter'
import { Bindings } from './bindings'
import { authMiddleware } from './auth'
import { uploadFile, UploadOptions } from './storage'

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

// Upload route
app.post('/upload', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as unknown as File
    const path = formData.get('path')?.toString();
    const fileName = formData.get('fileName')?.toString();
    const overwrite = formData.get('overwrite')?.toString() === 'true';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return c.json({ error: 'No file provided or the form data is incorrect.' }, 400)
    }

    const options: UploadOptions = {
      path,
      fileName,
      overwrite,
    };

    const result = await uploadFile(c, file, options)
    return c.json(result)
  } catch (error: any) {
    console.error('Upload failed:', error.message)
    return c.json({ error: 'Upload failed', message: error.message }, 500)
  }
})

export { app } 