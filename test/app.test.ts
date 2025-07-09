import { vi, test, afterEach, beforeEach, type Mock } from 'vitest'
import { app } from '../src/app'
import { getAllBucketsConfig } from '../src/storage'

// Mock the storage module
vi.mock('../src/storage', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual, // Keep actual implementations for functions we don't mock
    uploadFile: vi.fn().mockResolvedValue({
      success: true,
      url: 'https://example.com/file.png',
      fileName: 'file.png',
    }),
    // We will mock getAllBucketsConfig in specific tests
    getAllBucketsConfig: vi.fn(),
  }
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('GET / should return OK', async ({ expect }) => {
  const res = await app.request('/')
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('OK')
});

test('GET /buckets returns only whitelisted buckets for the given user id', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'test-secret');

  (getAllBucketsConfig as Mock).mockReturnValue({
    'bucket1': { id: 'bucket1', provider: 'CLOUDFLARE_R2', idWhitelist: ['user1-id'] },
    'bucket2': { id: 'bucket2', provider: 'AWS_S3', idWhitelist: ['user2-id'] },
    'private_bucket': { id: 'private_bucket', provider: 'AWS_S3' } // No whitelist, should not be visible to anyone
  });

  const req = new Request('http://localhost/buckets', {
    headers: {
      'Authorization': 'Bearer test-secret',
      'X-User-Id': 'user1-id'
    }
  });

  const res = await app.fetch(req);
  expect(res.status).toBe(200);
  const data = await res.json() as { buckets: { id: string }[] };
  expect(data.buckets.length).toBe(1);
  expect(data.buckets[0].id).toBe('bucket1');
});

test('GET /buckets returns empty list if user id is not provided', async ({ expect }) => {
  vi.stubEnv('AUTH_SECRET_KEY', 'test-secret');

  (getAllBucketsConfig as Mock).mockReturnValue({
    'bucket1': { id: 'bucket1', provider: 'CLOUDFLARE_R2', idWhitelist: ['user-id'] },
  });

  const req = new Request('http://localhost/buckets', {
    headers: { 'Authorization': 'Bearer test-secret' }
  });

  const res = await app.fetch(req);
  expect(res.status).toBe(200);
  const data = await res.json() as { buckets: any[] };
  expect(data.buckets.length).toBe(0);
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
  vi.stubEnv('BUCKET_main_r2_PROVIDER', "CLOUDFLARE_R2")
  vi.stubEnv('BUCKET_main_r2_BINDING_NAME', "R2_MAIN_BUCKET")
  vi.stubEnv('BUCKET_main_r2_ID_WHITELIST', 'test-user-id')

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
      'X-User-Id': 'test-user-id',
    },
  })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    success: true,
    url: 'https://example.com/file.png',
    fileName: 'file.png',
  })
}) 