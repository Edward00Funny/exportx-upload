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
  const { AUTH_SECRET_KEY, AUTH_TYPE } = env(c)

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

  // Get bucket from query parameter (optional)
  const bucketName = c.req.query('bucket')

  // If a bucket is specified, perform bucket-level validation
  if (bucketName) {
    let bucketConfig: BucketConfig;
    try {
      bucketConfig = getBucketConfig(c, bucketName);
    } catch (error: any) {
      console.error(`Failed to get config for bucket '${bucketName}':`, error.message);
      return c.json({ error: 'Configuration error for the specified bucket.' }, 500);
    }

    // If AUTH_TYPE is TOKEN_AND_EMAIL_WHITELIST, check email whitelist for the bucket
    if (AUTH_TYPE === 'TOKEN_AND_EMAIL_WHITELIST') {
      if (!bucketConfig.emailWhitelist || bucketConfig.emailWhitelist.length === 0) {
        console.error(`Email whitelist is required for bucket '${bucketName}' when AUTH_TYPE is TOKEN_AND_EMAIL_WHITELIST`);
        return c.json({ error: 'Service unavailable: Email whitelist not configured for this bucket.' }, 503);
      }

      const userEmail = c.req.header('X-User-Email');
      if (!userEmail) {
        return c.json({ error: 'Unauthorized: User email required for whitelist validation.' }, 401);
      }

      if (!bucketConfig.emailWhitelist.includes(userEmail)) {
        return c.json({ error: 'Unauthorized: Email not in whitelist for this bucket.' }, 403);
      }
    }

    // Pass bucket config to the next middleware/handler
    c.set('bucketConfig', bucketConfig);
  }

  await next();
}); 