# IAM setup

This page is documentation only. Nothing here is applied automatically; every change is run by
a person with approval.

```
EKS pod (IRSA) ──▶ hub role ──sts:AssumeRole + SetSourceIdentity──▶ secrets-console role (per account)
laptop (profile) ─────────────────────────────────────────────────▶ secrets-console role
```

For every call the app requests:

- **RoleSessionName** `sc-<entra oid>`;
- **SourceIdentity** set to the user's UPN, so CloudTrail shows the real person;
- **a session policy for the user's tier** (`src/lib/aws/session-policies.ts`). The session's
  effective permissions are the intersection of the role policy and that session policy.

## 1. Target role in each account: `secrets-console`

### Trust policy

Trust **only** the principals the app runs as: the hub IRSA role, and, if you want local use,
specific developer principals. Anyone else who can assume this role with a `sc-…` session name
can also impersonate "via Secrets Console" entries on the Activity page.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AppWithSourceIdentity",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::<HUB_ACCOUNT_ID>:role/<HUB_ROLE>",
          "arn:aws:iam::<ACCOUNT_ID>:user/<local-dev-user>"
        ]
      },
      "Action": ["sts:AssumeRole", "sts:SetSourceIdentity"],
      "Condition": { "Null": { "sts:SourceIdentity": "false" } }
    }
  ]
}
```

The condition refuses any session without a SourceIdentity, so every session names a person.

For AWS SSO developer roles, use `"Principal": {"AWS": "arn:aws:iam::<ACCOUNT_ID>:root"}` together
with `"ArnLike": {"aws:PrincipalArn": "arn:aws:iam::<ACCOUNT_ID>:role/aws-reserved/sso.amazonaws.com/*/AWSReservedSSO_<PermissionSet>_*"}`.

### Permissions (inline policy `secrets-console-access`)

This grants the admin tier; the session policies narrow it for readers and writers.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "List", "Effect": "Allow", "Action": "secretsmanager:ListSecrets", "Resource": "*" },
    {
      "Sid": "AdminTierOnAccountSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecretVersionIds",
        "secretsmanager:CreateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource",
        "secretsmanager:DeleteSecret",
        "secretsmanager:RestoreSecret",
        "secretsmanager:UpdateSecretVersionStage"
      ],
      "Resource": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:*"
    },
    {
      "Sid": "KmsViaSecretsManagerOnly",
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "secretsmanager.<REGION>.amazonaws.com" } }
    },
    {
      "Sid": "CloudTrailActivity",
      "Effect": "Allow",
      "Action": "cloudtrail:LookupEvents",
      "Resource": "*"
    }
  ]
}
```

- **To limit the console to part of an account,** use a name prefix:
  `...:secret:team/*`. `ListSecrets` can't be scoped, so names outside the prefix still appear
  in the list but can't be opened.
- **Customer-managed KMS keys:** the key policy must also allow this role to use the key.
- **`cloudtrail:LookupEvents`** is read-only and has no resource-level scoping. Only the admin
  session policy includes it.

## 2. Hub role in the EKS cluster account (IRSA)

Trust policy (OIDC):

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<HUB_ACCOUNT_ID>:oidc-provider/<OIDC_PROVIDER>" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "<OIDC_PROVIDER>:sub": "system:serviceaccount:<NAMESPACE>:<SERVICE_ACCOUNT>",
      "<OIDC_PROVIDER>:aud": "sts.amazonaws.com"
    }
  }
}
```

Permissions:

```json
{
  "Effect": "Allow",
  "Action": ["sts:AssumeRole", "sts:SetSourceIdentity"],
  "Resource": "arn:aws:iam::*:role/secrets-console"
}
```

Annotate the chart's ServiceAccount with
`eks.amazonaws.com/role-arn: arn:aws:iam::<HUB_ACCOUNT_ID>:role/<HUB_ROLE>`
(see `helm/aws-secrets-manager/values.example.yaml`).

## 3. Verify

```bash
# As the base identity (e.g. AWS_PROFILE=<dev profile>):
aws sts assume-role --role-arn arn:aws:iam::<ACCOUNT_ID>:role/secrets-console \
  --role-session-name sc-verify --source-identity you@example.com   # must succeed
aws sts assume-role --role-arn arn:aws:iam::<ACCOUNT_ID>:role/secrets-console \
  --role-session-name sc-verify                                     # must be AccessDenied
```

Symptoms in the app:

| Symptom                                  | Likely cause                                                      |
| ---------------------------------------- | ----------------------------------------------------------------- |
| "AWS denied this request for your role." | Trust policy or role permissions; the session policy for the tier |
| "AWS credentials expired…"               | The base identity expired, e.g. an SSO login needs refreshing     |
