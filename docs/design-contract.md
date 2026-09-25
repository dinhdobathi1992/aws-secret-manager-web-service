# Secrets Console: design contract

This is the agreed UI/UX contract for the console. It replaces the version approved on 2026-09-25
(dark zinc, Geist). The new direction follows the look of the original Flask app
(`dinhdobathi1992/aws-secret-manager-web-service`) and keeps every security rule from the earlier
contract. Source of truth for the visuals: the "Secrets Console — UX refactor" design canvas
(`https://claude.ai/artifact/1mYfwTiqoafAHP3wqGjfj4`). Change this file first when the design
changes.

## 1. Principles

- **Friendly and clear.** Light, airy, card-based internal tool. One accent (indigo) marks the
  main action on every screen. Colour carries meaning (role, state, action type), never decoration.
- **Values are hidden by default.** Nothing about a value, including its key names, is on screen
  until an audited **View**. Viewed values hide again automatically.
- **Show only the actions the user's role allows.** The server enforces every rule regardless.
- **Confirm every destructive or state-changing step** with a summary of what changes, never
  showing values.
- **Keyboard first.** `/` focuses search, `Esc` closes dialogs, focus is trapped in dialogs,
  every control is a real `<button>`, `<a>` or `<input>`.
- **No emoji in the UI.** Icons are line icons (lucide style, 2 px stroke).

## 2. Visual tokens

Theme: light. Dark mode keeps the header toggle but is **not redesigned yet** (open item, see §9).

| Token                | Value                                      | Use                                          |
| -------------------- | ------------------------------------------ | -------------------------------------------- |
| `--background`       | `#f5f7fb`                                  | Page ground                                  |
| `--card`             | `#ffffff`                                  | Cards, tables, dialogs, nav                  |
| `--surface-subtle`   | `#f9fafb`                                  | Table headers, card footers, expanded rows   |
| `--foreground`       | `#111827`                                  | Headings, key text                           |
| `--body`             | `#1a1f36`                                  | Body text                                    |
| `--label`            | `#374151`                                  | Form labels, emphasised meta                 |
| `--muted-foreground` | `#6b7280`                                  | Secondary text (never lighter for text)      |
| `--placeholder`      | `#9ca3af`                                  | Input placeholders and decorative icons only |
| `--border`           | `#e5e7eb`                                  | Hairlines, inputs                            |
| `--border-strong`    | `#d1d5db`                                  | Outlined buttons, dashed "add" buttons       |
| `--primary`          | `#4f46e5` (hover `#4338ca`)                | Primary buttons, links, active nav/tab       |
| `--primary-subtle`   | `#eef2ff` (border `#c7d2fe`)               | Active nav item, selected option, icon tiles |
| `--success`          | `#059669` (hover `#047857`)                | Create / Edit / Save actions                 |
| `--destructive`      | `#b91c1c`                                  | Danger zone, delete                          |
| `--code-bg`          | `#1a1f36`                                  | Value block in the View dialog               |
| `--code-fg`          | `#e5e7eb` (keys `#a5b4fc`, meta `#9ca3af`) | Text in the value block                      |

**Radius:** cards 10 px, buttons and inputs 8 px, dialogs 12 px, chips 6 px, tags and pills full.

**Elevation:**

- Cards and nav: `0 2px 4px rgba(0,0,0,.05)`, no border.
- Filled buttons: `0 1px 3px rgba(0,0,0,.1)`.
- Dialogs: `0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04)` over a
  `rgba(17,24,39,.5)` backdrop.

**Typography:** Inter (400/500/600) for UI and JetBrains Mono for secret paths in titles, version
ids, keys, values and activity secret names. Scale: page title 30/600, dialog title 20/600,
section 17–18/600, body 14–15, meta 12–13, table header 12/600 uppercase, 0.04em tracking.
Times use tabular numbers.

### Buttons

| Kind        | Look                                              | Use                                         |
| ----------- | ------------------------------------------------- | ------------------------------------------- |
| Primary     | Indigo fill, white text                           | View secret, Copy as JSON                   |
| Success     | Green fill, white text                            | Create secret, Edit secret, Save, Save tags |
| Secondary   | White, `--border-strong` outline, `--label` text  | Details, Hide, Cancel, Discard, Newest      |
| Ghost       | Indigo text, no fill                              | Open details, Add tags                      |
| Dashed      | Transparent, dashed `--border-strong`, muted text | Add key, Add tag, Tag filter                |
| Destructive | Red fill; greyed and `disabled` until confirmed   | Schedule deletion                           |

Heights: 38 px default, 42 px for page-level actions, 32–34 px inside toolbars and rows.

### Semantic colours (100 background / 800 text)

| Meaning                                  | Colour                                                                                            | Where                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- |
| Role **reader**                          | grey `#f3f4f6 / #374151`                                                                          | Role badges                   |
| Role **writer**                          | blue `#dbeafe / #1e40af`                                                                          | Role badges, "recent" badge   |
| Role **admin**                           | amber `#fef3c7 / #92400e`                                                                         | Role badges, admin-only marks |
| Stage **AWSCURRENT**                     | green `#dcfce7 / #166534`                                                                         | Version stage chip            |
| Stage **AWSPREVIOUS**                    | grey                                                                                              | Version stage chip            |
| Key diff: added / changed / removed      | green / amber / red                                                                               | Edit rows, save confirmation  |
| Freshness: this week / ≤ 90 days / older | dot green `#16a34a` / amber `#f59e0b` / grey `#71717a`                                            | "Updated" line on secrets     |
| Activity action (pill + icon)            | View blue · Create green · Delete red · Restore teal · Update amber · Rollback violet · Tags grey | Activity table                |
| Activity source                          | Secrets Console grey · **Outside app** amber                                                      | Activity table                |
| Unsaved changes                          | amber dot `#f59e0b`, amber field border                                                           | Value and tag editors         |
| Danger                                   | red border `#fecaca`, footer `#fef2f2`                                                            | Danger zone                   |

**Tag colours** come from a fixed palette picked by a stable hash of the tag key (violet, teal,
sky, amber, indigo, green). **Rose/red is excluded** so tags never look like errors or deletes.

## 3. Layout and shell

- **Container:** centred, `max-width: 1200px`, 20 px padding (1160 px content). 32 px between the
  nav and the page, 24 px between sections.
- **Nav card** (64 px, white, floating, rounded):
  - logo tile (indigo key icon on `--primary-subtle`) and **Secrets Console**;
  - links **Secrets**, **Activity** (admin only), **Scheduled deletion** with a count. Links are
    indigo text; the current page gets a `--primary-subtle` background;
  - on the right: a current-account chip (name + role badge), theme toggle, user pill (indigo
    initial avatar + name), **Logout**.
- **Account picker:** on the Secrets page, a white card labelled "AWS account" with one button per
  account. The current account is filled indigo with its short id `1234…9012` and role. Only
  accounts where the user has a role are listed, and the card says so.
- **Responsive** down to 1024 px. Mobile gets a readable view only.

## 4. Screens

### 4.1 Sign in (`/login`)

Centred white card with the app name, one line of explanation, and **Sign in with Microsoft**
(primary). Errors appear inline: groups overage, attempt expired, failure, provider unavailable.
In development with `DEV_AUTH=1` only, a dashed "Dev persona login" box picks a role per account.
Production builds don't contain it.

### 4.2 Secrets list (`/a/[account]`)

- Account picker card (§3).
- Header: "Secrets" (30/600), "N secrets in ACCOUNT · REGION", and **Create secret** (success,
  writer and up).
- Toolbar:
  - search ("Search by name prefix", `/` hint), filtered on the server;
  - active tag filters as indigo pills with a remove button;
  - **+ Tag filter** (dashed; key, optional value);
  - **Cards / Table** layout switch on the right (remembered per viewer).
- **Cards** (default, 3 columns, 24 px gap). Each card:
  - key icon tile, the name with the path muted and the **last segment bold**, the description
    below, and a copy-name icon button;
  - tag pills (key lighter, value bold);
  - freshness dot + "Updated **1 hour ago** · DATE";
  - a footer pinned to the bottom of the card (all cards in a row align): **View secret**
    (primary, opens the View dialog) and **Details** (secondary, opens the detail page).
- **Table** layout: name, tags, last changed, actions, for accounts with many secrets. Sortable
  Name and Last changed (within the current page).
- Pagination: "Showing N secrets", rows per page (25/50/100), Previous / Next (AWS token).
- A note under the list: values stay hidden until View, and every view is recorded.
- The list never shows secret type or key count: getting them would mean reading the value.

### 4.3 View secret dialog (quick view)

Opened from **View secret** on a card. Opening it is the audited read.

- Title "View secret: `name`", the line "This view was recorded in CloudTrail as UPN", close.
- A countdown bar and "Hides in **Ns**" (30 s; also hides when the tab is hidden).
- Dark value block: key count, **Key / value | Raw JSON** switch, one row per key (key in indigo
  tint, value, a copy button per key). Plain text and binary get a labelled raw view.
- Actions: **Copy as JSON** (primary), **Hide now**, **Open details** (ghost), **Edit secret**
  (success, writer and up; opens the detail page in edit state).

### 4.4 Create secret (dialog)

- Name (mono, placeholder `team/app/purpose`, allowed characters under it) and description
  (optional), side by side.
- **Secret type** cards: RDS database · DocumentDB · Redshift · Other. The selected card has an
  indigo border and `--primary-subtle` fill.
- **Value** with a Key / value · JSON · Plain text switch. Choosing a type fills in the **key
  names** of its template (e.g. RDS: username, password, engine, host, port, dbname). Example
  text is placeholder only, never a real value. Password fields are masked.
- **+ Add key**, **+ Add tags** (optional).
- **Cancel** and **Create secret** (success). Creating opens the new secret's page.

### 4.5 Secret detail (`/a/[account]/s/…name`)

- **‹ Back to secrets** (indigo link), the name as a mono title (26/600), the description, and
  **Copy name** / **Copy ARN** on the right.
- **Four tiles** (separate white cards):

  | Tile                    | Value                                                                | Detail                                                             |
  | ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
  | Current version (green) | Short id, `AWSCURRENT` chip                                          | "N versions retained · View history"                               |
  | Value changed (indigo)  | Relative time of the current version, **recent** badge within 7 days | Exact UTC time; notes a delete/restore or metadata change after it |
  | Last accessed (grey)    | Date only                                                            | "AWS records access by day"                                        |
  | Encryption (grey)       | "AWS managed key" or "Customer managed key"                          | Key alias or id                                                    |

  "Value changed" comes from the current version's creation date, not `LastChangedDate`, so a
  restore or tag edit doesn't look like a new value.

- **Tabs:** Value · Versions (count) · Tags (count), and **Danger zone** (admin only) pushed to
  the right in red with an admin badge. The active tab is indigo with a 2 px underline.
- A red banner when deletion was requested: "Deletion was requested on DATE", with a link to
  restore.

#### Value tab

- **Hidden state:** one compact card: lock tile, "Values are hidden", "Viewing is recorded in
  CloudTrail as UPN. Values hide again after 30 seconds or when you leave the tab", and **View
  secret** (primary). No key names are shown.
- **Viewed / editing state:**
  - toolbar: **Key / value | Raw JSON** switch, status pill, **Hide**;
  - rows: key (mono), value input, copy and remove buttons. A changed row shows an amber
    **CHANGED** chip and an amber field border; new rows show **NEW**;
  - **+ Add key** (writers);
  - status pill: countdown normally, "Auto-hide paused while you have unsaved changes" (amber)
    after a real edit;
  - footer (only when dirty): amber dot, "N keys changed. Saving creates a new version; the
    current one becomes AWSPREVIOUS", **Discard**, **Save new version…** (success).
- **Save confirmation dialog:** lists **key names only**, grouped as changed / added / removed,
  says values never appear there, and says the save stops if the secret changed since it was
  opened. **Cancel** / **Save version** (success). On conflict: "The secret changed since you
  opened it" with **Reload**.
- Raw edits of a JSON or key/value secret must stay valid JSON.

#### Versions tab

- Table: version (short id, full id on hover), stage chips or "deprecated", created (relative +
  UTC).
- Per row: **Compare keys** (key names only, both reads audited), **View** (dialog that closes
  after 30 s or when the tab is hidden), **Make current** (admin, not on the current version).
- Sort order: current, then previous, then newest.
- With a single version, a footer explains that Compare keys and Make current appear after the
  next save.
- **Make current** opens a confirmation dialog with an admin badge. It re-reads the current
  version when it opens, shows "Moves AWSCURRENT from X to Y", and carries an amber note: it is
  cancelled if the current version changes first.

#### Tags tab

- Key/value input rows with remove buttons, **+ Add tag** (dashed), new rows marked **NEW**.
- Footer with an amber dot and "N unsaved changes", **Discard** and **Save tags** (success). Save is
  enabled only when something changed.
- Side notes: tags don't create a version; `aws:`-prefixed keys are reserved (rejected in any
  letter case). Readers see the tags read-only.

#### Danger zone (admin)

- White card with a red border, trash icon, "Delete this secret", admin badge.
- Three facts: **Takes effect** (immediately, apps reading it fail), **Recovery window** (30 days,
  from Scheduled deletion), **Gone for good** (about DATE).
- An amber warning when AWS reports the secret was accessed recently ("Something may still read
  it. Check with its owners first").
- "Type `name` to confirm" with a "Doesn't match yet" hint. **Schedule deletion** stays disabled
  and grey until the name matches exactly, then turns red. The app redirects to Scheduled deletion
  afterwards.

### 4.6 Scheduled deletion (`/a/[account]/deleted`)

Table in a white card: name, description, **Requested**, **Deletes on (about)** (request date plus
the 30-day window), a red "N days left" badge, and **Restore** (admin).

### 4.7 Activity (`/a/[account]/activity`, admin only)

- Header: "Activity" with an admin badge and "Secrets Manager events in ACCOUNT from AWS CloudTrail
  (up to 90 days), including changes made outside this app". Range select (24 h / 7 d / 30 d /
  90 d) and **Newest** on the right.
- **Filter tiles** (they are the filters, `aria-pressed`): **Changes & views** (default, hides
  list/describe) · Views (with number of people) · Changes · Failed (rejected by AWS) · All events
  (including list/describe). The selected tile has an indigo border and subtle indigo fill.
- Toolbar: **User** and **Secret name** search (instant, in the browser) and "Showing N of M loaded
  events".
- **Table**, grouped under a day header ("Thursday, Sep 24, 2026 · N events"):

  | Column     | Content                                                                         |
  | ---------- | ------------------------------------------------------------------------------- |
  | Time (UTC) | Clock time bold (tabular), relative time small beside it                        |
  | Event      | Action pill with icon, then the secret name bold mono (link), `×N` when grouped |
  | Who        | Initial avatar and UPN / IAM name                                               |
  | Source     | Grey **Secrets Console** or amber **Outside app** (AWS console / CLI / SDK)     |
  | Result     | Muted check + "Success", or a red pill with the AWS error code                  |
  |            | Expand button                                                                   |

- Identical consecutive events (same user, action, secret and minute) collapse into one row with
  `×N`. Delete rows get a light red background.
- **Expanded row:** AWS event, request id, version, role session, source IP, and "Secret values
  are never recorded in CloudTrail".
- **Footer:** blocked in-app attempts are only in the app's audit log. **Load older events** (a
  cursor with the pinned time window).

### 4.8 States

- **403** is shown in place: "This action requires <tier>. Your role in this account is
  <role>." It never shows group ids.
- **404:** "Not found. The secret or account doesn't exist, or you don't have access to it."
  The same message covers an account where the user has no role.
- **AWS errors** use an amber inline alert with a fixed message and a hint, e.g. "AWS credentials
  expired…", "AWS denied this request for your role…", "AWS is rate-limiting…".
- **Loading:** skeletons. **Errors:** an error boundary that shows only a reference digest.
- **No access yet:** shown after sign-in with no role in any account, with a Sign out link.
- **Toasts:** bottom-right, green for success, red for fixed error text. Never values.

## 5. Role visibility

| Element                                              | reader       | writer       | admin |
| ---------------------------------------------------- | ------------ | ------------ | ----- |
| Create secret, Edit secret, Add key, Save, edit tags | hidden       | ✓            | ✓     |
| Danger zone tab, Make current, Restore               | hidden       | hidden       | ✓     |
| Activity link / page                                 | hidden / 403 | hidden / 403 | ✓     |
| View secret, Compare keys, version View              | ✓            | ✓            | ✓     |

## 6. Behaviour rules

| Rule                                  | Value                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Auto-hide viewed values               | 30 s with a visible countdown, and immediately when the page becomes hidden. Paused only after a real edit by a user who can edit |
| Clipboard clear after copying a value | 30 s, best-effort                                                                                                                 |
| Session length                        | 1 h absolute. Group changes apply at the next sign-in                                                                             |
| Delete                                | Always a 30-day recovery window, never force-delete                                                                               |
| Conflict handling                     | Save and Make current check the current version and offer **Reload**                                                              |
| URL encoding of names                 | Encoded per segment. Names with `.`, `..` or empty segments use a single `~`-prefixed segment                                     |
| Toasts                                | Bottom-right. Success or fixed error text only, never values                                                                      |
| Layout preference                     | Cards / Table choice kept in the viewer's browser only                                                                            |

## 7. Wording

- **View** is the verb for an audited read everywhere: buttons, dialogs, audit notes and the
  Activity action (CloudTrail `GetSecretValue`). "Reveal" is no longer used.
- "Value changed" means a new version; "Updated" on cards means AWS `LastChangedDate`.
- Say "Outside app" for changes made through the AWS console, CLI or SDK.

## 8. Accessibility baseline

Real interactive elements only. Icon-only buttons have `aria-label`. Toggle groups and filter
tiles use `aria-pressed`; expand buttons use `aria-expanded`. Dialogs come from Radix (focus trap,
`Esc`). Text contrast is at least 4.5:1 (muted text `#6b7280` on white; `#9ca3af` is never used for
text). Colours that must be told apart also differ in lightness or carry a label or icon
(freshness dots have labels, action pills have icons). There is no formal WCAG conformance target
(a plan decision).

## 9. Open items

- Dark mode tokens for the light design.
- Table layout of the secrets list is specified but not yet drawn on the canvas.
- Scheduled deletion and Sign in are not yet redrawn in the new style.

## 10. Approved decisions log

| Date       | Decision                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | Prototype approved. Rollback is per-row **Make current**; delete lives on a **Danger zone** tab                                                   |
| 2026-09-25 | No key names before View, for audit reasons                                                                                                       |
| 2026-09-25 | Activity page is admin-only, backed by CloudTrail, with no database (Thi)                                                                         |
| 2026-09-25 | Visual direction switched to the original Flask app's look: light, Inter, indigo primary, green create/save, white cards (Thi)                    |
| 2026-09-25 | Secrets list uses cards with View secret / Details, plus a Table layout switch; account picker is a visible button card                           |
| 2026-09-25 | Quick **View secret** dialog with dark value block, per-key copy and countdown; Create dialog keeps RDS / DocumentDB / Redshift / Other templates |
| 2026-09-25 | Detail header has four tiles (adds Last accessed; "Value changed" uses the current version date)                                                  |
| 2026-09-25 | Activity: tiles are the filters; table columns Time · Event · Who · Source · Result; Outside app highlighted; repeats collapsed (Thi)             |
| 2026-09-25 | "Reveal" renamed **View**; emoji removed from the UI; rose removed from the tag palette                                                           |

## 11. Implementation notes

Where the build had to choose, and why.

- **Fonts** are self-hosted (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`),
  bundled at build time. The CSP allows no external font requests, so the canvas's Google Fonts
  link is not used.
- **Secondary buttons** follow the canvas: grey fill (`#f3f4f6` / `#4b5563`) for Cancel, Hide,
  Discard, Copy name/ARN, Newest. The white outlined style is the `outline` variant (Details,
  account picker, pager).
- **"View" is UI wording only.** The action id, the audit `action` value (`reveal`) and the
  `ACTION_MIN_ROLE` keys are unchanged, so log pipelines and alerts keep working.
- **Edit secret** (View dialog) opens the detail page with `?edit=1` and runs one more audited
  View there, so the editor starts from fresh values (a second audit line). It runs only after a
  real click in the same tab: the click leaves a one-time intent in `sessionStorage`, and the
  page consumes it and drops `edit=1` from the URL. A crafted link, a refresh or Back shows the
  hidden state instead.
- **Success green is `#047857`** (hover `#065f46`), not `#059669`: white on `#059669` is 3.8:1,
  below the 4.5:1 floor in §8.
- **Create dialog** starts on **Other** (one empty row). Picking a template keeps any value already
  typed under the same key. Values are masked except for known non-secret template keys
  (`username`, `engine`, `host`, `port`, `dbname`, `ssl`).
- **Activity repeats** collapse only when user, action, secret, **result** and minute match, so a
  failure never hides inside a run of successes. The expanded row shows the newest event.
- **Account switching** happens on the Secrets page picker. The nav chip shows the current account
  and role only.
- **Dark mode** uses interim zinc tokens mapped to the new names (§9).
