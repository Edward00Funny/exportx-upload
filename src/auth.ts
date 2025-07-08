import { createMiddleware } from 'hono/factory'
import { env } from 'hono/adapter'
import { Bindings } from './bindings'

/**
 * validate environment variable AUTH_SECRET_KEY is configured
 */
export function validateAuthEnvironment(authSecretKey?: string): { isValid: boolean; error?: string } {
  if (!authSecretKey) {
    console.error('AUTH_SECRET_KEY environment variable not set. Service is disabled.');
    return {
      isValid: false,
      error: 'Service unavailable: Authentication is not configured.'
    };
  }
  return { isValid: true };
}

/**
 * validate Authorization header and token
 */
export function validateAuthToken(authHeader?: string, validTokens?: string[]): { isValid: boolean; error?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: 'Unauthorized: Missing or invalid Authorization header.'
    };
  }

  const token = authHeader.substring(7); // "Bearer ".length

  if (!validTokens || !validTokens.includes(token)) {
    return {
      isValid: false,
      error: 'Unauthorized: Invalid token.'
    };
  }

  return { isValid: true };
}

/**
 * simplified auth middleware, only responsible for basic token validation
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const { AUTH_SECRET_KEY } = env(c);

  // validate environment variable
  const envValidation = validateAuthEnvironment(AUTH_SECRET_KEY);
  if (!envValidation.isValid) {
    return c.json({ error: envValidation.error }, 503);
  }

  // validate Authorization header and token
  const authHeader = c.req.header('Authorization');
  const validTokens = AUTH_SECRET_KEY!.split(',');
  const tokenValidation = validateAuthToken(authHeader, validTokens);

  if (!tokenValidation.isValid) {
    return c.json({ error: tokenValidation.error }, 401);
  }

  await next();
}); 