# Entra ID (Azure AD) setup

## 1. App registration

Go to Entra admin center → **App registrations** → **New registration**.

- **Supported account types:** this organisation only.
- **Authentication** → platform **Web** → redirect URIs:
  - `http://localhost:3000/api/auth/callback` (local)
  - `https://<your host>/api/auth/callback` (each deployed `APP_URL`)

  The app always builds the redirect URI as `${APP_URL}/api/auth/callback`. A mismatch shows
  `AADSTS50011` on the Microsoft page.

- **Certificates & secrets** → new client secret. It becomes `ENTRA_CLIENT_SECRET`, and its
  expiry date is when you must rotate it.
- **Overview:** Directory (tenant) ID → `ENTRA_TENANT_ID` (must be the GUID), Application (client)
  ID → `ENTRA_CLIENT_ID`.
- No API permissions beyond the default sign-in are needed. The app never calls Microsoft Graph.

## 2. Groups claim (roles)

Go to **Token configuration** → **Add groups claim**.

| Option                             | Plan        | Notes                                                                                                    |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| **Security groups**                | Free        | Works on every plan. The token lists the user's security groups (checked on a free tenant, 2026-09-25)   |
| Groups assigned to the application | Entra ID P1 | Only the groups assigned to the app appear in the token, which avoids overage. Nested groups are ignored |

Emit the claim in the **ID** token as **Group ID**.

- **Overage:** users in more than about 200 groups get an overage marker instead of `groups`.
  The app rejects that sign-in with an explanation; there is no Graph fallback. The fix is
  "Groups assigned to the application" (P1).
- **Optional claim `upn`** (ID token) makes CloudTrail's SourceIdentity the UPN. Without it the
  app uses `preferred_username`.

## 3. Groups per AWS account

Create three **security** groups per account and add people:

| Role   | Example name              |
| ------ | ------------------------- |
| reader | `Secret_<account>_reader` |
| writer | `Secret_<account>_writer` |
| admin  | `Secret_<account>_admin`  |

Copy each group's **Object ID** (Groups → the group → Overview, or
`az ad group show --group <name> --query id -o tsv`) into `ACCOUNTS[].groups`. One set of groups
can be reused across accounts if the same people should have the same role everywhere.

- **The highest role wins.** A member of both writer and admin is admin.
- **Avoid broad groups for admin** (for example a general "Admin" group). Everyone in it can
  delete and roll back secrets.
- **Changes apply at the next sign-in** (sessions last at most 1 hour). Users can also sign out
  and back in.

## 4. Check

- Sign in, then look at the server log line `{"event":"login", …}`. It shows `groupCount` (how
  many groups the token carried) and `roles` (the resolved tier per account); group ids are
  never logged.
- `groupCount: 0` means the groups claim isn't configured for the ID token.
- `groupCount > 0` with empty `roles` means the ids in `ACCOUNTS` don't match the groups the
  user is in.
