import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3400)

/** e2e against a production build (standalone server) backed by moto. No cloud access. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'scripts/e2e-server.sh',
    url: `http://localhost:${PORT}/api/health?ready`,
    timeout: 240_000,
    reuseExistingServer: false,
    // SIGTERM (not the default kill) so scripts/with-moto.sh can stop its moto container.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    env: { E2E_PORT: String(PORT), VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
  },
})
