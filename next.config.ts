import type { NextConfig } from 'next'

// Only static values here. `output: 'standalone'` serialises the resolved config at build time,
// so anything env-derived (APP_URL, CSP origins, allowedOrigins) would be frozen into the image.
// The CSP is a per-request nonce set in src/proxy.ts instead.
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Enables forbidden() and the app/forbidden.tsx 403 page.
  experimental: { authInterrupts: true },
  // `next dev` prints every server action's arguments by default, which would include secret
  // values passed to updateSecretValue/createSecret. Never re-enable.
  logging: { serverFunctions: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/a/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
