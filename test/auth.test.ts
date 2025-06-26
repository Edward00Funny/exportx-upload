import { Hono } from 'hono'
import { test, vi, afterEach } from 'vitest'
import { authMiddleware } from '../src/auth'
import { Bindings } from '../src/bindings'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('authMiddleware should return 503 if AUTH_SECRET_KEY is not set', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', '')
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const res = await app.request('/')
  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ error: 'Service unavailable: Authentication is not configured.' })
})

test('authMiddleware should return 401 if Authorization header is missing', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'test-secret')
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const res = await app.request('/')
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'Unauthorized: Missing or invalid Authorization header.' })
})

test('authMiddleware should return 401 for invalid token', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1,secret2')
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer invalid-token' },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'Unauthorized: Invalid token.' })
})

test('authMiddleware should call next() for valid token', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should return 503 if email whitelist is required but not configured', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('AUTH_TYPE', 'TOKEN_AND_EMAIL_WHITELIST')
  vi.stubEnv('EMAIL_WHITELIST', '')

  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ error: 'Service unavailable: Email whitelist not configured.' })
})

test('authMiddleware should return 401 if email is required but not provided', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('AUTH_TYPE', 'TOKEN_AND_EMAIL_WHITELIST')
  vi.stubEnv('EMAIL_WHITELIST', 'test@example.com')

  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'Unauthorized: User email required for whitelist validation.' })
})

test('authMiddleware should return 403 if email is not in whitelist', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('AUTH_TYPE', 'TOKEN_AND_EMAIL_WHITELIST')
  vi.stubEnv('EMAIL_WHITELIST', 'test@example.com')

  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: {
      Authorization: 'Bearer secret1',
      'X-User-Email': 'other@example.com',
    },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'Unauthorized: Email not in whitelist.' })
})

test('authMiddleware should call next() for valid token and email', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('AUTH_TYPE', 'TOKEN_AND_EMAIL_WHITELIST')
  vi.stubEnv('EMAIL_WHITELIST', 'test@example.com')
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: {
      Authorization: 'Bearer secret1',
      'X-User-Email': 'test@example.com',
    },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
}) 