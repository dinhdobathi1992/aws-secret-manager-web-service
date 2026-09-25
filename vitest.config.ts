import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // moto-backed tests run separately via `pnpm test:integration`.
    exclude: ['**/node_modules/**', 'src/**/*.moto.test.ts'],
    environment: 'node',
  },
})
