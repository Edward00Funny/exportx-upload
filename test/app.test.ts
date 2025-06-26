import { vi, test, afterEach } from 'vitest'
import { app } from '../src/app'

// Mock the storage module
vi.mock('../src/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    success: true,
    url: 'https://example.com/file.png',
    fileName: 'file.png',
  }),
  getAllBucketsConfig: vi.fn().mockReturnValue({
    'main_r2': { provider: 'CLOUDFLARE_R2' }
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs()
})

test('GET / should return OK', async ({ expect }) => {
  const res = await app.request('/')
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
});

test('POST /upload should return 401 without auth', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'a-secret-key')
  const res = await app.request('/upload', {
    method: 'POST',
  })
  expect(res.status).toBe(401);
});

test('POST /upload should upload a file with valid auth', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'test-secret')
  vi.stubEnv('DEFAULT_BUCKET_CONFIG_NAME', 'main_r2')
  vi.stubEnv('BUCKET_main_r2_PROVIDER', "CLOUDFLARE_R2")
  vi.stubEnv('BUCKET_main_r2_BINDING_NAME', "R2_MAIN_BUCKET")

  const file = new File(['dummy content'], 'test.png', { type: 'image/png' })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', 'images')
  formData.append('bucket', 'main_r2')

  const res = await app.request('/upload', {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: 'Bearer test-secret',
    },
  })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    success: true,
    url: 'https://example.com/file.png',
    fileName: 'file.png',
  })
}) 