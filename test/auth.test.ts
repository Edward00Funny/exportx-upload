import { Hono } from 'hono'
import { test, vi, afterEach } from 'vitest'
import { authMiddleware } from '../src/auth'
import { Bindings } from '../src/bindings'

// Define a type for the test context that includes our custom variables
type TestEnv = {
  Variables: {
    bucketConfig?: any;
  },
  Bindings: Bindings
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('authMiddleware should return 503 if AUTH_SECRET_KEY is not set', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', '')
  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const res = await app.request('/')
  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ error: 'Service unavailable: Authentication is not configured.' })
})

test('authMiddleware should return 401 if Authorization header is missing', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'test-secret')
  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const res = await app.request('/')
  expect(res.status).toBe(401)
})

test('authMiddleware should return 401 for invalid token', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1,secret2')
  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer invalid-token' },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(401)
})

// This test checks token auth without a bucket, which should pass
test('authMiddleware should call next() for valid token when no bucket is specified', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should pass through with valid token even when bucket is specified (bucket validation is handled elsewhere)', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/?bucket=nonexistent', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(200) // authMiddleware only validates tokens
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should pass through with valid token even when bucket config has no id whitelist', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  // Stub bucket config WITHOUT id whitelist
  vi.stubEnv('BUCKET_CONFIGS', JSON.stringify([
    {
      "id": "test_bucket",
      "provider": "CLOUDFLARE_R2",
      "bindingName": "R2_BUCKET"
    }
  ]))

  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/?bucket=test_bucket', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)

  expect(res.status).toBe(200) // authMiddleware only validates tokens
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should pass through with valid token even when user id is not provided', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('BUCKET_CONFIGS', JSON.stringify([
    {
      "id": "test_bucket",
      "provider": "CLOUDFLARE_R2",
      "bindingName": "R2_BUCKET",
      "idWhitelist": ["test-user-id"]
    }
  ]))

  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/?bucket=test_bucket', {
    headers: { Authorization: 'Bearer secret1' },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(200) // authMiddleware only validates tokens
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should pass through with valid token even when user id is not in bucket whitelist', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('BUCKET_CONFIGS', JSON.stringify([
    {
      "id": "test_bucket",
      "provider": "CLOUDFLARE_R2",
      "bindingName": "R2_BUCKET",
      "idWhitelist": ["test-user-id"]
    }
  ]))

  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/?bucket=test_bucket', {
    headers: {
      Authorization: 'Bearer secret1',
      'X-User-Id': 'other-user-id',
    },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(200) // authMiddleware only validates tokens
  expect(await res.text()).toBe('OK')
})

test('authMiddleware should call next() for valid token and user id in bucket whitelist', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'secret1')
  vi.stubEnv('BUCKET_CONFIGS', JSON.stringify([
    {
      "id": "test_bucket",
      "provider": "CLOUDFLARE_R2",
      "bindingName": "R2_BUCKET",
      "idWhitelist": ["test-user-id"]
    }
  ]))

  const app = new Hono<TestEnv>()
  app.use('*', authMiddleware)
  app.get('/', (c) => c.text('OK'))

  const req = new Request('http://localhost/?bucket=test_bucket', {
    headers: {
      Authorization: 'Bearer secret1',
      'X-User-Id': 'test-user-id',
    },
  })
  const res = await app.fetch(req)
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
}) 