import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Secrets Console',
  description: 'AWS Secrets Manager console',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the request headers keeps every route dynamic, which the per-request CSP nonce needs.
  await headers()
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
