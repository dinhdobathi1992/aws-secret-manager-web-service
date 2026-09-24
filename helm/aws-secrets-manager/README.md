# aws-secrets-manager Helm chart

Deploys Secrets Console (Next.js) to EKS. The pod's base AWS identity is IRSA on the chart's
ServiceAccount; for each configured account the app calls `sts:AssumeRole` on that account's
`roleArn` with a per-tier session policy and the user as `SourceIdentity`.

## Breaking change: 0.1.x → 0.2.0

0.2.0 is a new application, and its values are not compatible with 0.1.x. There was no existing
release to migrate, so no cutover steps are provided.

| 0.1.x | 0.2.0 |
|---|---|
| `configMap.AWS_ACCOUNTS` (object keyed by name, optional `role_arn`) | `accounts[]`: `id`, `name`, `region`, **required** `roleArn`, and `groups.{reader,writer,admin}` (Entra group object ids) |
| `secrets.azure.*`, `FLASK_SECRET_KEY` | `auth.existingSecret` (recommended), or `auth.{sessionSecret,tenantId,clientId,clientSecret}` |
| `env.FLASK_*` | removed; `app.{url,name,logoUrl,logLevel}` and `extraEnv` |
| container port 5001, health `/health/liveliness` | container port **3000**, liveness `/api/health`, readiness `/api/health?ready` |
| service port 5001 | service port 80 → `http` (3000) |

## Install

```bash
cp values.example.yaml values-prod.yaml   # gitignored; fill in accounts, app.url, IRSA role, host, cert
helm lint . -f values-prod.yaml
helm template sc . -f values-prod.yaml | less
helm upgrade --install sc . -n secrets-console --create-namespace -f values-prod.yaml
```

Create the auth Secret first (or with External Secrets):

```bash
kubectl -n secrets-console create secret generic secrets-console-auth \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)" \
  --from-literal=ENTRA_TENANT_ID=<tenant-guid> \
  --from-literal=ENTRA_CLIENT_ID=<client-id> \
  --from-literal=ENTRA_CLIENT_SECRET=<client-secret>
```

## Values

| Key | Default | Notes |
|---|---|---|
| `app.url` | `""` | Public URL. The Entra redirect URI must be `<url>/api/auth/callback` |
| `accounts` | `[]` | See `values.example.yaml`. Rendered as JSON into the `ACCOUNTS` env var |
| `auth.existingSecret` | `""` | Keys: `SESSION_SECRET`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` |
| `serviceAccount.annotations` | `{}` | `eks.amazonaws.com/role-arn` for the hub IRSA role |
| `ingress.*` | disabled | ALB example in `values.example.yaml`; health check path `/api/health` |
| `extraEnv` | `[]` | e.g. `AWS_REGION` if the IRSA webhook doesn't inject it |
| `replicaCount` | `1` | Sessions are cookie-only, so scaling out needs no code change |

## Operational notes

- With the default (empty) values, `helm install --wait` waits until timeout: the pod is
  deliberately NotReady until configured.
- **Readiness 503 means the configuration didn't parse.** The pod log names the failing field,
  for example `ACCOUNTS[prod].groups.admin`. Liveness never calls AWS, so AWS trouble doesn't
  restart pods.
- The pod runs as uid 1001 with a read-only root filesystem. `/app/.next/cache` and `/tmp` are
  emptyDirs. An `EROFS` error at startup means a writable path is missing; add an emptyDir
  rather than turning the setting off.
- `HOSTNAME` is forced to `0.0.0.0`. Kubernetes sets it to the pod name, and Next binds to it.
- Server actions rely on Next's Origin check against Host / X-Forwarded-Host, so the ALB must
  preserve Host (it does by default). Symptom when it doesn't: "Invalid Server Actions request".
- Config and auth changes roll the pods automatically through checksum annotations; the auth
  checksum only applies when the chart manages the Secret.
