# Specification: 2027 Season Data Migration

**Goal:** Rebuild the data-capture pipeline so the app works for the 2026/27 season, replacing the now-dead unauthenticated `players.json` feed with the site's authenticated JSON API — while keeping the Firebase data model and the frontend display app (`dreamteam26-vercel`) unchanged.

---

## 1. How it worked last season (2026)

The system is two apps sharing one Firebase Realtime Database:

- **Capture app** (`dtcapture26_new`) — fetches player data, lets you build manager teams, and writes everything to Firebase.
- **Display app** (`dreamteam26-vercel`) — reads Firebase and renders the league table, teams, and player status.

Data flow of the capture app:

1. `src/app/api/players/route.ts` fetched `https://www.dreamteamfc.com/json/season/players.json` (no auth) and returned an array of raw players.
2. `translatePlayerData()` in `src/lib/utils.ts` converted each raw player into the DB's `playerDetails` shape, using `getClubName(squadId)` to turn a numeric squad id into a club code.
3. The player pool was written to Firebase `/1/playerData`; manager teams (captured through the UI) to `/0`; a timestamp to `/2/0`.

**Firebase paths (`src/lib/constants.ts`) — unchanged for 2027:**

| Path | Contents |
|------|----------|
| `/0` | Array of managers (each with `teamDetails[]`) |
| `/1/playerData` | Full player pool |
| `/2/0` | Last-updated timestamp |

Because these paths and shapes stay identical, **the display app needs no changes.**

---

## 2. What breaks in 2027

The old `players.json` endpoint is no longer reachable without authentication. The replacement is the site's private backend API:

```
https://engagecraft-fantasy-backend-prod.azurewebsites.net/api
```

Every call needs an `Authorization: Bearer <token>` header, the token expires ~24h after issue, and the main data endpoint is paginated. The endpoint's field names differ from the old feed — but they actually line up with the app's internal `PlayerData`/`Player` types *more* closely than the old feed did.

**Endpoints (from the scraping handoff):**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tournament-calendars/active` | Current `tournamentCalendarId` (needed by everything) |
| `GET /api/players/stats?type=gameweek&tournamentCalendarId=<id>&sortBy=pts&sortDir=desc&page=<n>&limit=100` | Main player-stats feed, paginated |
| `POST /api/auth/login` | Issues a Bearer token (expires ~24h) |
| `GET /api/matches/fixtures?type=gameweek` | Fixtures |
| `GET /api/matches/contestants?tournamentCalendarId=<id>` | Teams |

Response shape of `/players/stats`:

```
{ "success": true,
  "data": {
    "items": [ { player… }, … ],
    "pagination": { "page": 1, "limit": 100, "total": 517, "totalPages": 6 }
  } }
```

---

## 3. Design decisions (need your sign-off)

### 3.1 How to get the token — DECIDED: manual token, entered via the UI

The login is **Auth0 with email 2FA on every login** (identity handled by `thesun.co.uk`, not the Azure backend). A fresh email code is required each time you authenticate, so scripted auto-login is impossible — any automated flow would stall waiting for a code in your inbox. So the pipeline uses a **manually supplied token**. In practice this costs little: one login per day clears 2FA and yields a token valid for the full 24h.

**Token entry via the UI (chosen mechanism).** Rather than editing `.env.local`, the app prompts for the token in the capture UI at retrieval time:

1. When you trigger *Retrieve data*, a **token modal / password-style field** appears (a small "Set token" control in the admin area covers re-entry mid-session).
2. On paste, the app **validates client-side** by decoding the JWT: checks it is well-formed and that `exp` is in the future, and surfaces a friendly "expires in Xh Ym" or "already expired — grab a fresh one" message.
3. The token is held in **session memory** (React state; optionally `sessionStorage` so a page refresh doesn't lose it). Never written to disk, never committed, cleared on tab close.
4. Each retrieval **POSTs the token to `/api/players`** (request body or `Authorization` header); the server route uses it for the paginated Azure fetch.
5. On a `401` from Azure, the app **clears the stored token and re-prompts**.

How to obtain a token to paste: DevTools → Network → filter `azurewebsites` → any `/api` call → Request Headers → copy the `authorization` value (after `Bearer `). Roughly once a day after a fresh login.

_(An optional `DTFC_TOKEN` env fallback could remain for headless runs, but the UI paste is the primary path.)_

**Confirmed token facts** (decoded from a live sample):

- Standard JWT, `Authorization: Bearer <token>`.
- **Lifetime is exactly 24 hours** (`iat`→`exp`).
- The `sub` claim is the **user id** (e.g. `1423`). The `/api/players` endpoint's `userId` param is decoded from the token's `sub` at runtime — no separate entry needed.
- `aud: "2"`, `scopes: []`.

**Implementation & security notes:**
- `route.ts` takes the token **from the incoming request** (not env), and decodes `sub` for any endpoint needing `userId`.
- **Redact `authorization` in logs** — the current `route.ts` logs request headers; that must not include the token.
- Decode `exp` client-side and block the call early if the token is already expired, with a clear message.
- The token rides in request bodies between the browser and your own server route, so it stays on your infrastructure; it is a self-expiring, user-scoped credential (low risk).

### 3.2 tournamentCalendarId — fetch, don't hardcode

The handoff hardcoded `be2cf2c1-…`. That id changes each season. `route.ts` should call `/api/tournament-calendars/active` once per run and use whatever id it returns, so 2028 needs no code change.

### 3.3 Player id is now a UUID string

Last season `playerId` was a number (e.g. `184254`). The new API returns a UUID string (e.g. `ad405b69-28f6-…`). `src/lib/types.ts` still declares `playerId: number` in a couple of interfaces (though `SPECIFICATION-update-manager.md` already uses `string`), so those need aligning to `string`. Because ids change format, manager teams captured this season won't match last season's numeric ids — which is fine, since teams are re-picked each season.

### 3.4 Price is no longer scaled

Old feed prices needed `price / 1000000`. The new API already returns human values (`2.5`, `3.0`), so the division must be **removed** — otherwise every price becomes ~0.

### 3.5 Club mapping changes

Old feed used a numeric `squadId` → `getClubName()`. The new API has no `squadId`; it gives `contestantFlagKey` (e.g. `AVL`, `NFO`, `BHA`). We need a new map from flag key → your club codes. See §5.

### 3.6 New repo: `dreamteam27`

Per decision, this season's code lives in a **new `dreamteam27` app**, not a branch of `dtcapture26_new`. Approach: copy the capture app as the starting point (it already contains the manager-capture UI, search, and selection rails) and apply the §7 data-layer changes there. The manager-selection rules (§6) and `APP_CONSTANTS` (11 players / £50M) come across as-is.

**Decided: two apps**, mirroring the current split — a new **`dreamteam27` capture app** (copied from `dtcapture26_new`, with the §7 data-layer changes) and a separate new **`dreamteam27` display app** (copied from `dreamteam26-vercel`). Both point at the same Firebase and keep their current roles. The data-layer changes in §7 apply only to the capture app.

---

## 4. Field mapping (old → new → DB)

The DB target shape (`playerDetails`) is unchanged. Only the *source* fields change.

| DB field (`playerDetails`) | Old `players.json` | New Azure API | Note |
|---|---|---|---|
| `playerId` | `id` (number) | `playerId` (UUID string) | type change → string |
| `playerName` | `displayName` | `displayName` | same |
| `playerPosition` | `position` | `position` | same values (GK/DEF/MID/STR) |
| `playerClub` | `getClubName(squadId)` | `getClubFromFlag(contestantFlagKey)` | new map (§5) |
| `gwpts` | `gameweekPoints ?? 0` | `gameweekPoints ?? 0` | same field name |
| `gwtotalPts` | `totalPoints` | `totalPoints` | same |
| `playerValue` | `price / 1000000` | `price` | **remove division** |
| `playerinjured` | `status === 'injured'` etc. | `injuryDetails != null` / `availabilityDisplay` | derive from new fields |
| `playerSuspended` | `status === 'suspended'` | `suspensionDetails != null` | derive from new fields |
| `playereliminated` | `status === 'eliminated'` | `availabilityDisplay` | confirm value for eliminated |
| `playerDNP` | `status==='playing' && gwpts===null` | `gameweekPoints === null` | keep logic |

The new API also exposes `averagePoints`, `last3Average`, `bonusPoints`, `percentSelected`, and `nextGameweekFixtures` — available if you later want richer stats, but not required to match the current DB shape.

---

## 5. Club mapping (flag key → app code)

Confirmed from the sample response:

| API `contestantFlagKey` | App code |
|---|---|
| ARS | ARS |
| AVL | VILLA |
| BOU | BOU |
| BRE | BRE |
| BHA | BRI |
| CHE | CHE |
| EVE | EVE |
| LEE | LEE |
| LIV | LIV |
| NFO | FOR |

Best-guess for the remaining 2026/27 clubs (Opta-style keys — **must be verified against a full scrape**):

| API key (to verify) | App code |
|---|---|
| CRY | PAL |
| FUL | FUL |
| MCI | MAN C |
| MUN | MAN U |
| NEW | NEW |
| SUN | SUN |
| TOT | SPURS |
| WHU | WHAM |
| WOL | WOL |
| BUR | BUR |

**Method to finalise deterministically:** run one full scrape, collect the set of distinct `contestantFlagKey` values (there'll be exactly 20), and confirm each maps to a club code. Unmapped keys fall back to `Unknown`. This removes all guesswork.

---

## 6. Team selection & formation rules (carried over)

These rules already exist in the capture components and `APP_CONSTANTS`; they carry into `dreamteam27` unchanged. Documented here for completeness and for validation when migrating.

- **Squad size:** exactly 11 players (`APP_CONSTANTS.MAX_PLAYERS = 11`).
- **Budget:** total price ≤ £50.0M (`APP_CONSTANTS.BUDGET_LIMIT = 50.0`). Note prices come straight from the new API now (no `/1000000`), so budget maths must use the un-scaled value.
- **No duplicate players:** the search/selection rail prevents picking the same player twice.
- **Goalkeeper:** always exactly 1 GK.
- **Allowed outfield formations** (GK + DEF-MID-STR):

  | Formation | GK | DEF | MID | STR |
  |-----------|----|-----|-----|-----|
  | 4-4-2 | 1 | 4 | 4 | 2 |
  | 4-3-3 | 1 | 4 | 3 | 3 |
  | 4-5-1 | 1 | 4 | 5 | 1 |
  | 3-4-3 | 1 | 3 | 4 | 3 |
  | 3-5-2 | 1 | 3 | 5 | 2 |
  | 5-4-1 | 1 | 5 | 4 | 1 |
  | 5-3-2 | 1 | 5 | 3 | 2 |

- **Admin flow:** admin creates a manager and inputs that manager's chosen 11; the rails reject any pick that would break duplicates, budget, or an allowed formation.

**Migration checks:** since positions (`GK/DEF/MID/STR`) and the price field feed these rails, confirm after the data-layer swap that (a) every player carries a valid position, and (b) prices are un-scaled — otherwise the budget rail silently misbehaves.

---

## 7. File-by-file changes (data layer)

1. **`src/app/api/players/route.ts`** — replace the single `players.json` fetch with:
   - (Option B) `POST /api/auth/login` → obtain token; or read `DTFC_TOKEN` env (Option A).
   - `GET /api/tournament-calendars/active` → `tournamentCalendarId`.
   - Loop `GET /api/players/stats?…&page=n&limit=100` using `pagination.totalPages`, collecting `data.items`, with a gentle delay between pages.
   - Return the combined `items` array (raw), leaving translation to `utils.ts`.

2. **`src/lib/utils.ts`** — 
   - Add `getClubFromFlag(flagKey: string): Club` using the §5 map.
   - Update `translatePlayerData()`: read new field names, drop the `/1000000` price division, derive status booleans from `injuryDetails`/`suspensionDetails`/`availabilityDisplay`, keep UUID `playerId` as string.
   - Keep `getClubName(squadId)` for reading any legacy data, but it's no longer on the write path.

3. **`src/lib/types.ts`** — change `playerId: number` → `playerId: string` (and any dependent interfaces); make `squadId` fully optional/deprecated.

4. **Env (`.env.local`)** — add `DTFC_EMAIL` + `DTFC_PASSWORD` (Option B) or `DTFC_TOKEN` (Option A). Server-side only; never `NEXT_PUBLIC_`.

5. **Downstream check** — grep for numeric `playerId` assumptions (`parseInt`, `Number(playerId)`, numeric comparisons) in the capture components (`managers/*`, `update/*`, `upload/*`) and fix any that assume a number.

**Display app (`dreamteam26-vercel`): no changes.** It reads the same Firebase paths and shapes.

---

## 8. Theming & colour schemes

**Goal:** swap the whole app's colours by changing one setting, and add new palettes without touching components. Both apps get this system; each ships with a different default palette for 2026/27, distinct from last season.

### 8.1 Mechanism

- **CSS variables are the single source of truth.** Each palette is a block of custom properties under a `data-theme` selector in `globals.css`.
- **Semantic roles, not colour names.** Components reference roles (`--bg`, `--primary`, `--text`…), never raw hex. This is what makes palettes swappable.
- **Tailwind maps to the variables** via `theme.extend.colors`, so utilities like `bg-background`, `text-content`, `bg-primary`, `border-border` just work.
- **Active theme = one attribute:** `<html data-theme="prussian">`. Set the per-app default in the root layout. An optional dropdown can switch it live (writes the attribute + `localStorage`).

```css
/* globals.css */
:root,
[data-theme="prussian"] {
  --bg: #0D0C1D;            /* page background      (Ink Black)      */
  --surface: #161B33;      /* cards                (Prussian Blue)  */
  --surface-2: #474973;    /* raised/table header  (Dusty Grape)    */
  --primary: #474973;      /* buttons / accents    (Dusty Grape)    */
  --primary-contrast: #F1DAC4; /* text on primary  (Almond Cream)   */
  --accent: #A69CAC;       /* secondary accent     (Lilac Ash)      */
  --content: #F1DAC4;      /* main text            (Almond Cream)   */
  --content-muted: #A69CAC;/* muted text           (Lilac Ash)      */
  --border: #474973;       /* borders              (Dusty Grape)    */
}

[data-theme="aquamarine"] {
  --bg: #C5E0D8;           /* page background      (Frozen Water)    */
  --surface: #FFFFFF;      /* cards                (derived neutral) */
  --surface-2: #B5FFE9;    /* raised/table header  (Aquamarine)      */
  --primary: #444545;      /* buttons / accents    (Iron Grey)       */
  --primary-contrast: #FFFFFF; /* text on primary  (derived neutral) */
  --accent: #CEABB1;       /* secondary accent     (Cotton Rose)     */
  --content: #444545;      /* main text            (Iron Grey)       */
  --content-muted: #5F6060;/* muted text           (derived neutral) */
  --border: #C9C9C9;       /* borders              (Silver)          */
}
```

```js
// tailwind.config.js — theme.extend.colors
colors: {
  background: 'var(--bg)',
  surface: 'var(--surface)',
  'surface-2': 'var(--surface-2)',
  primary: 'var(--primary)',
  'primary-contrast': 'var(--primary-contrast)',
  accent: 'var(--accent)',
  content: 'var(--content)',
  'content-muted': 'var(--content-muted)',
  border: 'var(--border)',
}
```

### 8.2 The two 2026/27 palettes

| Role | `prussian` (Palette 1) | `aquamarine` (Palette 2) |
|------|------------------------|--------------------------|
| Background | `#0D0C1D` Ink Black | `#C5E0D8` Frozen Water |
| Surface (cards) | `#161B33` Prussian Blue | `#FFFFFF` (neutral) |
| Surface-2 / header | `#474973` Dusty Grape | `#B5FFE9` Aquamarine |
| Primary | `#474973` Dusty Grape | `#444545` Iron Grey |
| On-primary text | `#F1DAC4` Almond Cream | `#FFFFFF` |
| Accent | `#A69CAC` Lilac Ash | `#CEABB1` Cotton Rose |
| Text | `#F1DAC4` Almond Cream | `#444545` Iron Grey |
| Muted text | `#A69CAC` Lilac Ash | `#5F6060` (neutral) |
| Border | `#474973` Dusty Grape | `#C9C9C9` Silver |

`prussian` is a dark, moody theme; `aquamarine` is light and fresh. A 5-swatch palette doesn't cover every UI role, so a couple of neutral tints (white surface, mid-grey muted text) are **derived** for contrast/readability — they're also exposed as variables, so fully editable.

**Default per app (decided):** the **display app** defaults to `prussian` (dark, dramatic, public-facing); the **capture app** defaults to `aquamarine` (light, clean, admin). Both themes remain available in both apps — this only sets each app's starting `data-theme`, and is swappable in one line.

### 8.3 Adding a new theme later (3 steps)

1. Add a `[data-theme="yourname"] { … }` block in `globals.css` with the nine role variables.
2. (If using the switcher) add `"yourname"` to the theme list.
3. Set it as default in a layout, or pick it from the dropdown. No component changes.

### 8.4 File changes for theming (both apps)

- `globals.css` — add the `data-theme` variable blocks.
- `tailwind.config.js` — extend `colors` to reference the variables (above).
- Root `layout.tsx` — set the default `data-theme` on `<html>`.
- Migrate hardcoded colours in components (e.g. `bg-coralreef-950`, arbitrary hex) to the new semantic utilities. Optional: a small `ThemeSwitcher` dropdown.

---

## 9. Databases, environments & test data

### 9.1 Project & hosting topology (2026, confirmed)

- **Shared data DB:** `footieteamz26` Realtime Database (europe-west1) — the capture app writes here; the display app reads here via its `DATABASE_URL` env var.
- **Capture app hosting:** **Vercel** (free Hobby). `next.config.js` removed `output: 'export'` to enable the server API routes; `vercel.json` sets `framework: nextjs`. The scrape's `/api/players` route runs here server-side — this is why no Firebase Cloud Function is needed.
- **Display app hosting:** **Firebase Hosting** (Spark, free), static export (`output: 'export'`, `public: out`) on project `dreamteam26-77976`. Reads the RTDB client-side only.
- (The hardcoded `dreamteam26-77976` in `scripts/test-wissa.ts` was a stray/legacy reference — the live data is in `footieteamz26`.)

### 9.2 New database for 2026/27: `footieteamz27`

Mirror last season with a **new Firebase project `footieteamz27`** and its default Realtime Database (europe-west1):

- **Same structure:** `/0` managers · `/1/playerData` · `/2/0` last-updated timestamp.
- **Same rules** (`database.rules.json`): `{ ".read": true, ".write": "auth != null" }`.
- **Recreate write auth:** the capture app signs in a service-account user (email/password) before writes (`firebase-service.ts` → `authenticateServiceAccount`). Set up the same auth user and env creds in the new project.
- **Why a new project, not a second instance:** multiple RTDB instances in one project require the Blaze plan; a fresh project gives a clean default RTDB exactly like last season.

### 9.3 Testing against last season's data

- Leave `footieteamz26` **untouched as a read-only reference.**
- **Seed `footieteamz27`** with a copy: Firebase console → `footieteamz26` → Realtime Database → Export JSON → Import JSON at the root of `footieteamz27`. (Or an admin-SDK copy script.)
- This validates the display app, league table, statuses, and both colour themes against realistic content.

**Caveat — id format change:** last season's `playerId`s are numeric; the new scrape writes UUIDs.

- Seeded data is fine for **display/theming** testing as-is.
- Testing the **new scrape** overwrites `/1/playerData` with UUID-based players.
- Seeded `/0` manager teams still render (names are stored inline in `playerDetails`), but their numeric ids won't match the new UUID pool — expected; teams are re-picked for the new season.

### 9.4 Env wiring

- Point both new apps' `DATABASE_URL` (capture: `NEXT_PUBLIC_DB_DATABASE_URL`; display: `NEXT_PUBLIC_FIREBASE_DATABASE_URL`) at `https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app`.
- Add the new project's Firebase config + service-account creds to each `.env.local`.
- Optionally keep `footieteamz26` creds available (read-only) for a one-off export/import helper.

### 9.5 Pre-season reset

Before go-live, clear `/0` (and `/1/playerData`) to start fresh while keeping the structure and rules. (See §11 open question on starting empty.)

### 9.6 Zero-cost constraint (Firebase Spark) — hard rule

Everything must stay on the **free tier**. Design rules that keep it there:

- **New project, not a second RTDB instance.** Creating `footieteamz27` as its own project uses that project's free default database. (A second database *instance* inside one project requires the Blaze plan — avoid.)
- **No Cloud Functions.** The scrape runs as a **Vercel** API route (free Hobby tier), never a Firebase Function (which now requires Blaze).
- **Email/password Auth** for the service-account writer is free on Spark.
- **Static hosting** for the display app is free on Spark; the capture app hosts on Vercel free.
- **Spark RTDB limits** (1 GB stored, 10 GB/month egress, 100 concurrent) far exceed this app's needs.
- **Vercel Hobby** is free for personal, non-commercial use — fine here.

Net: no Blaze upgrade, no billing enabled, £0.

---

## 10. Testing & rollout

1. **Auth probe** — confirm `POST /api/auth/login` request/response shape with one manual capture; wire up Option B (or A).
2. **Dry run** — hit the updated `/api/players/route.ts`, print the first few translated players, verify names, clubs (all 20 keys mapped), prices (sane values, not ~0), positions, status.
3. **Club-key completeness** — assert exactly 20 distinct flag keys, none falling back to `Unknown`.
4. **Write to a test path** — write the pool to a scratch Firebase path (e.g. `/1/playerData_test`) and diff against last season's structure before overwriting `/1/playerData`.
5. **End-to-end** — capture one manager team in the UI, confirm it saves to `/0`, and confirm the display app renders it.
6. **Season kickoff note** — points are all `0` pre-season; re-verify `gwpts`/`gwtotalPts` populate correctly after gameweek 1.

---

## 11. Open questions for CJ

1. **New season, fresh DB** — start 2026/27 with an empty `/0` (managers re-pick), or migrate anything from last season?
2. **Richer stats** — want to also capture `percentSelected` / `nextGameweekFixtures` into the DB this season, or keep the shape identical for now?

_Resolved: theming via CSS-variable palettes (§8); defaults — display app `prussian`, capture app `aquamarine` (§8.2)._

_Resolved:_
- _Token strategy: manual `DTFC_TOKEN` in `.env.local` (Option A); auto-login ruled out by Auth0 email MFA (§3.1)._
- _Two-app structure: new `dreamteam27` capture + separate `dreamteam27` display, both on the same Firebase (§3.6)._
- _Manager selection rules and £50M / 11-player limits carry over (§6)._
