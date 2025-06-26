import { createMiddleware } from 'hono/factory'
import { Bindings } from './bindings'

export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  // If AUTH_SECRET_KEY is not set, deny all requests for security.
  if (!c.env.AUTH_SECRET_KEY) {
    console.error('AUTH_SECRET_KEY environment variable not set. Service is disabled.');
    return c.json({ error: 'Service unavailable: Authentication is not configured.' }, 503);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header.' }, 401);
  }

  const token = authHeader.substring(7); // "Bearer ".length
  const validTokens = c.env.AUTH_SECRET_KEY.split(',');

  if (!validTokens.includes(token)) {
    return c.json({ error: 'Unauthorized: Invalid token.' }, 401);
  }

  // If AUTH_TYPE is TOKEN_AND_EMAIL_WHITELIST, check email whitelist
  if (c.env.AUTH_TYPE === 'TOKEN_AND_EMAIL_WHITELIST') {
    if (!c.env.EMAIL_WHITELIST) {
      console.error('EMAIL_WHITELIST is required when AUTH_TYPE is TOKEN_AND_EMAIL_WHITELIST');
      return c.json({ error: 'Service unavailable: Email whitelist not configured.' }, 503);
    }

    // Extract email from request (assuming it's passed in a header or request)
    // For this implementation, we'll assume email is passed in X-User-Email header
    const userEmail = c.req.header('X-User-Email');
    if (!userEmail) {
      return c.json({ error: 'Unauthorized: User email required for whitelist validation.' }, 401);
    }

    const allowedEmails = c.env.EMAIL_WHITELIST.split(',').map(email => email.trim());
    if (!allowedEmails.includes(userEmail)) {
      return c.json({ error: 'Unauthorized: Email not in whitelist.' }, 403);
    }
  }

  await next();
}); 