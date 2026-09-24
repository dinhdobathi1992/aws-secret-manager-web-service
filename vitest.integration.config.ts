import path from 'node:path'
import { defineConfig } from 'vitest/config'

/** moto-backed integration tests; run through scripts/with-moto.sh (pnpm test:integration). */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    include: ['src/**/*.moto.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
