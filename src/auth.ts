import { createMiddleware } from 'hono/factory'
import { env } from 'hono/adapter'
import { Bindings, BucketConfig } from './bindings'
import { getBucketConfig } from './storage'

// Define a custom context type to include our new state
type AuthContext = {
  Variables: {
    bucketConfig?: BucketConfig
  }
}

export const authMiddleware = createMiddleware<AuthContext & { Bindings: Bindings }>(async (c, next) => {
  const { AUTH_SECRET_KEY } = env(c)

  // If AUTH_SECRET_KEY is not set, deny all requests for security.
  if (!AUTH_SECRET_KEY) {
    console.error('AUTH_SECRET_KEY environment variable not set. Service is disabled.');
    return c.json({ error: 'Service unavailable: Authentication is not configured.' }, 503);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header.' }, 401);
  }

  const token = authHeader.substring(7); // "Bearer ".length
  const validTokens = AUTH_SECRET_KEY.split(',');

  if (!validTokens.includes(token)) {
    return c.json({ error: 'Unauthorized: Invalid token.' }, 401);
  }

  // Get bucket from query params first, then from form data if it's a POST request
  let bucketName = c.req.query('bucket');

  // If not in query params and it's a POST request, try to get from form data
  if (!bucketName && c.req.method === 'POST') {
    try {
      const formData = await c.req.formData()
      bucketName = formData.get('bucket')?.toString()
    } catch (error) {
      // If form data parsing fails, that's ok, bucket might be in query params
      // or the request might not need bucket validation
    }
  }

  // If a bucket is specified, perform bucket-level validation
  if (bucketName) {
    let bucketConfig: BucketConfig;
    try {
      bucketConfig = getBucketConfig(c, bucketName);
    } catch (error: any) {
      console.error(`Failed to get config for bucket '${bucketName}':`, error.message);
      return c.json({ error: 'Configuration error for the specified bucket.' }, 500);
    }

    // Check id whitelist for the bucket
    if (!bucketConfig.idWhitelist || bucketConfig.idWhitelist.length === 0) {
      console.error(`ID whitelist is required for bucket '${bucketName}'`);
      return c.json({ error: 'Service unavailable: ID whitelist not configured for this bucket.' }, 503);
    }

    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ error: 'Unauthorized: User ID required for whitelist validation.' }, 401);
    }

    if (!bucketConfig.idWhitelist.includes(userId)) {
      return c.json({ error: 'Unauthorized: User ID not in whitelist for this bucket.' }, 403);
    }
    // Pass bucket config to the next middleware/handler
    c.set('bucketConfig', bucketConfig);
  }

  await next();
}); 