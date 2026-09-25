# Secrets Console: design contract

This is the agreed UI/UX contract for the console. Thi approved it on 2026-09-25 through the
prototype canvas (`https://claude.ai/artifact/RjAzjfoTKp3yR2K7f5sFfq`, Phases 5 and 8). The
implementation in `src/` follows it. Change this file first when the design changes.

Phase 9 (2026-09-25) applied Thi's UX refactor (`Secrets Console — UX refactor.html`): dark by
default, with the layout changes described below.

## 1. Principles

- **Quiet and dense.** An internal tool that looks and works like other internal tools. Colour
  carries meaning (role, state, change type) and is never decoration.
- **Values are hidden by default.** Nothing about a value, including its key names, is on screen
  until an audited **Reveal**. Revealed values hide again automatically.
- **Show only the actions the user's role allows.** The server enforces every rule regardless.
- **Confirm every destructive or state-changing step** with a summary of what changes, never
  showing values.
- **Keyboard first.** `/` focuses search, `Esc` closes dialogs, focus is trapped in dialogs,
  every control is a real `<button>`, `<a>` or `<input>`.

## 2. Visual tokens

Theme: shadcn/ui `radix-nova` preset, neutral (zinc) base, light and dark modes (**dark by default**,
toggle in the header). Source of truth: `src/app/globals.css`.

| Token                | Light                     | Dark                      | Use                                                    |
| -------------------- | ------------------------- | ------------------------- | ------------------------------------------------------ |
| `--background`       | `oklch(0.985 0 0)`        | `oklch(0.145 0 0)`        | Page ground (soft grey)                                |
| `--sunken`           | `oklch(0.975 0 0)`        | `oklch(0.178 0 0)`        | Header strips and footers inside cards                 |
| `--card`             | `oklch(1 0 0)`            | `oklch(0.205 0 0)`        | Cards, tables, dialogs                                 |
| `--foreground`       | `oklch(0.145 0 0)`        | `oklch(0.985 0 0)`        | Text                                                   |
| `--muted-foreground` | `oklch(0.45 0 0)`         | `oklch(0.708 0 0)`        | Secondary text (darkened from the preset for contrast) |
| `--primary`          | `oklch(0.205 0 0)`        | `oklch(0.922 0 0)`        | Primary buttons (near-black / near-white)              |
| `--border`           | `oklch(0.922 0 0)`        | `oklch(1 0 0 / 10%)`      | Hairlines                                              |
| `--destructive`      | `oklch(0.577 0.245 27.3)` | `oklch(0.704 0.191 22.2)` | Errors                                                 |
| `--radius`           | `0.625rem`                |                           | Cards use `rounded-xl`                                 |

**Typography:** Geist Sans for UI and Geist Mono for names, ids, versions, tags and values,
self-hosted through the `geist` package (no external font requests under the CSP). Scale: page
title 24/600, section 16–18/600, body 14, meta 12–13, table header 12/600 uppercase with letter
spacing.

**Elevation:** cards use a 1 px border. The secrets table card adds a soft shadow
(`0 1px 2px rgba(24,24,27,.04), 0 8px 24px -12px rgba(24,24,27,.08)`).

### Semantic colours

| Meaning                                  | Light                                                                                                      | Where                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Role **reader**                          | zinc 200 / 700                                                                                             | Role badges                     |
| Role **writer**                          | blue 100 / 800                                                                                             | Role badges, "recent" badge     |
| Role **admin**                           | amber 100 / 800                                                                                            | Role badges, admin-only markers |
| Stage **AWSCURRENT**                     | green 100 / 800                                                                                            | Version stage chip              |
| Stage **AWSPREVIOUS**                    | muted                                                                                                      | Version stage chip              |
| Key diff: added / changed / removed      | green / amber / red (50 bg, 800 text)                                                                      | Save confirmation, compare      |
| Freshness: this week / ≤ 90 days / older | green 600 / amber 600 / zinc 400 dot                                                                       | Secrets list "Last changed"     |
| Activity action                          | Reveal blue · Update amber · Create green · Delete red · Restore teal · Rollback violet · Tags/other muted | Activity table                  |
| Danger                                   | red 700 button, red 200 card border                                                                        | Danger zone, scheduled deletion |

Dark mode uses the matching 950 backgrounds with 300 text for every chip.

**Name and tag colours** come from a small fixed palette picked by a stable hash of the
top-level name prefix (`team`, `billing`, …) or the tag key (violet, teal, sky, rose, lime,
orange). No configuration is needed; unknown values still get a consistent colour.

## 3. Layout and shell

- **Top bar** (56 px, no sidebar, 40 px side padding), with:
  - the logo and `APP_NAME`;
  - a **bordered account switcher**: name, short account id, role badge;
  - **navigation tabs**: Secrets (active on the list and every secret page), **Activity** (admins
    only) and **Scheduled deletion** with a count;
  - on the right, the theme toggle and a single-letter avatar menu (name, UPN, Sign out).
- **Content** is up to 1440 px wide, with 40 px side padding.
- **Badges** are small rectangles (5 px radius, 11 px uppercase): roles, AWSCURRENT, RECENT,
  DEFAULT, CHANGED, NEW, ADMIN.
- **Inputs inside cards** sit on the page background colour. Table headers and card footers use
  `bg-sunken`.
- **Account switcher:** a command palette listing only accounts where the user has a role.

## 4. Screens

### 4.1 Sign in (`/login`)

Centred card with the app name, one line of explanation, and **Sign in with Microsoft**. Errors
appear inline: groups overage, attempt expired, failure, provider unavailable. In development
with `DEV_AUTH=1` only, a dashed "Dev persona login" box picks a role per account. Production
builds don't contain it.

### 4.2 Secrets list (`/a/[account]`)

- Header: "Secrets", then the account and region, and **New secret** (writer and up).
- Toolbar **inside the table card** (Phase 9):
  - search box ("Search by name prefix", `/` hint), filtered on the server;
  - the active tag filter as a pill with ✕;
  - a dashed **+ Tag filter** button, whose popover suggests the tags in view or takes a key and optional value;
  - **Clear**, when any filter is active: drops the search and tag filter, keeps page size and
    sort, and cancels a pending search so it can't bring the filters back.
- Table card:
  - Header row: "All secrets" or "Matching secrets", a count badge, and the freshness legend.
  - **Name:** a 32 px coloured prefix tile (first two letters of the top-level segment), the path
    muted plus the **last segment bold**, and the description on a second line.
  - **Tags:** tinted rectangular chips (5 px radius), key lighter and value bold. "No tags" when empty.
  - **Last changed:** a freshness dot, the relative time in bold, and the absolute date below.
  - **Actions:** copy name, open (chevron).
  - Sortable headers (Name, Last changed) sort within the current page.
- Footer: "Showing N secrets", rows per page (25/50/100), Previous (browser back) / Next (AWS
  token).
- Below the card: "Values and key names stay hidden until you open a secret and reveal it. Every reveal is recorded."
- The table never shows secret type or key count: getting them would mean reading the value.

### 4.3 Secret detail (`/a/[account]/s/…name`)

- Breadcrumb "‹ Secrets / name", the name as the mono title, and the description.
- **Copy name** and **Copy ARN** buttons on the right of the title.
- **Metadata strip:** a full-width card with four tiles.

  | Tile                    | Value                                                                           | Detail                                |
  | ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
  | Current version (green) | Short id, `AWSCURRENT`, copy                                                    | "N versions retained · View history"  |
  | Value changed (blue)    | Relative time (creation of the AWSCURRENT version), **RECENT** if within 7 days | Exact UTC time                        |
  | Last accessed (grey)    | Date, or "Never"                                                                | "AWS records access by day, not time" |
  | Encryption (grey)       | "AWS managed key · DEFAULT" or "Customer managed key · CMK"                     | Key alias or id                       |

- **Tabs:** Value · Versions (count) · Tags (count). **Danger zone** sits on the right, in red,
  with an ADMIN badge (admins only).
- A red banner when deletion was requested: "Deletion was requested on DATE", with a link to
  restore.

#### Value tab

- **Hidden state:** a lock icon, "Values are hidden", the audit note, and **Reveal values**. No
  key names are shown.
- **Revealed:**
  - A toggle between **Key / value** and **Raw JSON** for flat string maps. Other JSON, plain
    text, and binary (base64, read-only) each get a labelled raw view.
  - Per-key copy, which clears the clipboard after 30 s where the browser allows it. Add/remove
    key for writers.
  - "Hides in 30s or when you leave the tab". This changes to "Auto-hide paused while you have
    unsaved changes" once the user edits.
  - **Hide**.
- **Save new version** opens a confirmation dialog listing **key names only**, grouped as
  added / changed / removed, and noting that values never appear there. The save is conflict-
  checked against the revealed version. On conflict: "The secret changed since you revealed
  it" with **Reload**.
- Raw edits of a JSON or key/value secret must stay valid JSON.

#### Versions tab

- Table: version (short id, full id on hover), stage chips or "deprecated", created time.
- Per row: **Compare keys** (key names only, both reads audited), **Reveal** (dialog that closes
  after 30 s or when the tab is hidden), and **Make current** (admin, not on the current version).
- Sort order: current, then previous, then newest.
- **Make current** opens a confirmation dialog with an admin badge. It re-reads the current
  version when it opens, shows "Moves AWSCURRENT from X to Y", and carries an amber note: it is
  cancelled if the current version changes first.

#### Tags tab

Key/value rows. Writers can add, remove, save and discard; readers see them read-only.
`aws:`-prefixed keys are rejected in any letter case.

#### Danger zone (admin)

A red-bordered card with an admin badge. It explains the 30-day recovery window. The user must
**type the exact name to confirm**, then click **Schedule deletion** (red). The app redirects to
Scheduled deletion afterwards.

### 4.4 Create secret (dialog)

- Name, with a path hint (`team/app/purpose`) and allowed characters; description (optional).
- **Value type:** Key / value (password-masked value inputs) · JSON · Plain text.
- Tags (optional).
- **Create secret** opens the new secret's page.

### 4.5 Scheduled deletion (`/a/[account]/deleted`)

Table: name, description, **Requested**, **Deletes on (about)** (the request date plus the
30-day window), a red "N days left" badge, and **Restore** (admin).

### 4.6 Activity (`/a/[account]/activity`, admin only)

- Header: "Activity" with an admin badge, and "Secrets Manager events … from AWS CloudTrail … includes changes made outside this app".
- Header right: **Range** select (24 h / 7 d / 30 d / 90 d; a new range starts from the newest
  events) and **Newest**.
- **Filter tiles** (links, one active): **Changes & reveals** (default, hides list/describe),
  **Reveals** (with the number of people), **Changes** (create, update, tags, delete, restore),
  **Failed** (rejected by AWS), **All events** (including list/describe).
  A caption above the tiles states the scope: counts cover only the events loaded so far; a `+`
  after a count means older events exist and are not counted yet.
- **Search:** user and secret name, applied instantly in the browser over the loaded events;
  "Showing X of N loaded events".
- **Table:** a header row per UTC day; time as HH:MM UTC, who (initials avatar, UPN, "via Secrets Console" or "via AWS
  console / CLI"), colour-coded action, secret (link), result (green Success or red error
  code).
- **Expandable row:** a five-column grid (AWS event, request id, version, role session, source
  IP) and the note that values are never in CloudTrail.
- **Footer:** blocked in-app attempts are only in the app's audit log. **Load older events**
  (a cursor with the pinned time window).

### 4.7 States

- **403** is shown in place: "This action requires <tier>. Your role in this account is
  <role>." It never shows group ids.
- **404:** "Not found. The secret or account doesn't exist, or you don't have access to it."
  The same message covers an account where the user has no role.
- **AWS errors** use an amber inline alert with a fixed message and a hint, e.g. "AWS credentials
  expired…", "AWS denied this request for your role…", "AWS is rate-limiting…".
- **Loading:** skeletons. **Errors:** an error boundary that shows only a reference digest.
- **No access yet:** shown after sign-in with no role in any account, with a Sign out link.

## 5. Role visibility

| Element                                    | reader       | writer       | admin |
| ------------------------------------------ | ------------ | ------------ | ----- |
| New secret, Add key, Save value, edit tags | hidden       | ✓            | ✓     |
| Danger zone tab, Make current, Restore     | hidden       | hidden       | ✓     |
| Activity link / page                       | hidden / 403 | hidden / 403 | ✓     |
| Reveal, Compare keys, version Reveal       | ✓            | ✓            | ✓     |

## 6. Behaviour rules

| Rule                                  | Value                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Auto-hide revealed values             | 30 s, and immediately when the page becomes hidden. Paused only after a real edit by a user who can edit |
| Clipboard clear after copying a value | 30 s, best-effort                                                                                        |
| Session length                        | 1 h absolute. Group changes apply at the next sign-in                                                    |
| Delete                                | Always a 30-day recovery window, never force-delete                                                      |
| Conflict handling                     | Save and rollback check the current version and offer **Reload**                                         |
| URL encoding of names                 | Encoded per segment. Names with `.`, `..` or empty segments use a single `~`-prefixed segment            |
| Toasts                                | Bottom-right (sonner). Success or fixed error text only, never values                                    |

## 7. Accessibility baseline

Real interactive elements only. Icon-only buttons have `aria-label`. Dialogs come from Radix
(focus trap, `Esc`). Contrast: muted text was darkened to meet 4.5:1 on the grey ground. Colours
that must be told apart also differ in lightness (the freshness dots also have labels). There is
no formal WCAG conformance target (a plan decision).

## 8. Approved decisions log

| Date       | Decision                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | Prototype approved. Rollback is per-row **Make current**; delete lives on a **Danger zone** tab                     |
| 2026-09-25 | Detail metadata is a three-tile strip, not plain text (Thi's feedback)                                              |
| 2026-09-25 | Secrets table: prefix tiles, path/leaf emphasis, coloured tag chips, freshness dots, table toolbar (Thi's feedback) |
| 2026-09-25 | No key names before Reveal. This differs from the prototype, for audit reasons                                      |
| 2026-09-25 | Activity page is admin-only, backed by CloudTrail, with no database (Thi)                                           |

### Phase 9 screen updates (2026-09-25)

- **Value tab:**
  - The hidden state is one compact row that names who the reveal is recorded as.
  - Revealed: a segmented **Key / value | Raw JSON** control and a status pill (amber while
    auto-hide is paused).
  - **Existing keys are shown as text** (renaming = remove + add). Changed values get a
    **CHANGED** badge and an amber border; new rows get **NEW**.
  - A dashed **Add key** button.
  - Footer: "N key(s) changed/added/removed. Saving creates a new version; the current one
    becomes AWSPREVIOUS.", then Discard and **Save new version…**.
- **Save dialog:**
  - a grouped box (CHANGED / ADDED / REMOVED, with key names) and "Added: none" style summaries
    for empty groups;
  - a close ✕;
  - two notes: key names only, and the save stops on conflict.
- **Versions:** when there is a single version, a footer note explains that Compare keys and Make
  current appear after the next save.
- **Tags:** a 760 px card plus a notes column (tags don't create versions; `aws:` is reserved).
  **NEW** badges, and an "N unsaved changes" footer.
- **Danger zone:**
  - a fact grid: takes effect / recovery window / gone for good (about a date);
  - a last-accessed warning when AWS reports access;
  - live "Doesn't match yet" feedback;
  - a red footer strip with the button disabled until the name matches.
- **Activity:**
  - Range dropdown and **Newest** in the header.
  - **Five clickable filter tiles with counts:** Changes & reveals (default), Reveals, Changes,
    Failed, All events.
  - Card toolbar: User and Secret search, and "Showing X of N loaded events".
  - The table is grouped by UTC day and shows times as HH:MM.
  - Expanded details are a five-column grid.

| Date       | Decision                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| 2026-09-25 | Phase 9: Thi's UX refactor implemented. Dark by default. Behaviour and security are unchanged |
