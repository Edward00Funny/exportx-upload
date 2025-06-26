import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/bindings.d.ts',
        'src/adaptors/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
}) 