<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Secrets Console — agent guide

## Overview

Next.js 16 console for AWS Secrets Manager across accounts: Entra ID sign-in, per-account roles (reader/writer/admin) from Entra groups, AssumeRole per account with a per-tier session policy and SourceIdentity, admin Activity page from CloudTrail. One container; Helm chart in `helm/aws-secrets-manager`. Start with `README.md`.

## Build / lint / test

- Install: `pnpm install` (this repo is standalone, not the Devops pnpm workspace).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit, vitest). Single test: `pnpm vitest run src/lib/auth/rbac.test.ts -t "admin"`.
- `pnpm test:integration` (moto via Docker on :5055), `pnpm test:e2e` (Playwright, production build + moto on :3400/:5058).
- `scripts/build.sh` (image), `scripts/image-smoke.sh` (same image, two APP_URLs), `helm lint helm/aws-secrets-manager`.
- Local run without cloud: `pnpm dev:mock`. Real: `AWS_PROFILE=<p> pnpm dev` with `.env`.
- Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to silence a vitest config-loader warning.

## Code style

- TypeScript strict, Prettier (no semicolons, single quotes, width 100), kebab-case files.
- Server-only modules import `'server-only'`. Never export non-component constants from `'use client'` files for server use (they become client references).
- All mutations and value reads go through `withAction` in `src/lib/actions/`; pages only render metadata.
- Role checks come from `ACTION_MIN_ROLE` (`src/lib/auth/rbac.ts`); add new actions there first (session policies derive from it).

## Gotchas

- **Never log or render secret values.** Only allow-listed fields go to logs and audit. `JSON.parse`/`.json()` on secret data is lint-banned; use `safeParseJson`. Next's `logging.serverFunctions` must stay `false`; a test enforces it.
- `proxy.ts` is not an authorization boundary. Every page and action re-checks the role.
- Next 16 passes catch-all params percent-encoded; use `secretNameFromSegments` / `secretHref`.
- No env-derived values in `next.config.ts` (standalone freezes them at build time).
- Don't cache anything under `/a/*` (force-dynamic + no-store).
- moto ≠ AWS: `DeletedDate` semantics differ, IAM/KMS/session policies are unenforced, CloudTrail `LookupEvents` is unimplemented. See README "Known gaps".
- Port 5000 on macOS is AirPlay; moto uses 5055 (dev/integration) and 5058 (e2e).
- `.env`: no quotes (docker `--env-file` keeps them), no `$` (compose expands it).
- A file named `credentials.*` is blocked by a local privacy hook; the AWS credentials module is `src/lib/aws/assume-role.ts`.

## Deploy / infra

- Image: `node:24-alpine`, uid 1001, read-only root (writable: `/tmp`, `/app/.next/cache`). Chart 0.2.0 forces `HOSTNAME=0.0.0.0` (K8s sets it to the pod name).
- Base identity: IRSA on the chart's ServiceAccount. Per-account role and trust setup: `docs/iam-setup.md`. Entra: `docs/entra-setup.md`.
- Pushing images, `helm upgrade` and any IAM change need explicit approval from the owner.
