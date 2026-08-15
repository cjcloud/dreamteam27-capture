# DreamTeam27 — project status

> 🔒 **The player-data API is governed by an authoritative, change-controlled
> contract:** [`capture/docs/API-CONTRACT-player-retrieval.md`](capture/docs/API-CONTRACT-player-retrieval.md).
> It underpins the whole app. **Do not change how player data is fetched
> (endpoint, params, auth, or field mapping) without the sign-off + test process
> in that document.** The working logic was lost once before — this is the guard.

> 📓 **Working practice — documentation is a deliverable.** Capturing progress,
> the decisions behind it, and how problems were resolved **in this
> documentation** is a core deliverable of this project, not an afterthought.
> Any working session — human or AI — is expected to keep this file current:
> what changed, *why*, and what problem it solved. This `PROJECT-STATUS.md` is
> the canonical, version-controlled record and lives in the **capture repo**
> (`cjcloud/dreamteam27-capture`). When meaningful work or a decision lands,
> update it (or prompt for the update). When in doubt, write it down.

Snapshot of what's in place for the 2026/27 season. Two Next.js apps plus the
scraper, all under `projects/dreamteam27/`. Both apps deploy to **Vercel** from
**separate private GitHub repos** (see §11).

| Folder | Role |
|--------|------|
| `capture/` | Admin app — fetches player data from the authenticated API and writes to Firebase. Deploys to Vercel. Repo: `cjcloud/dreamteam27-capture` (private). |
| `display/` | Public app — reads Firebase and renders the league, teams, and analysis. Deploys to Vercel. Repo: `cjcloud/dreamteam27-display` (private). |
| `py scripts/` | Standalone scraper (`inspect_api.py`, `scrape_players.py`). |

---

## 1. Data & database

- **Live database:** `footieteamz27` Firebase Realtime Database (europe-west1).
  URL: `https://footieteamz27-default-rtdb.europe-west1.firebasedatabase.app`.
- **Credentials wired:** both apps' `.env.local` hold the `footieteamz27` web
  config (project id `footieteamz27`, sender id `252031780732`), and every code
  reference points at `footieteamz27`. **Reads and writes both verified live** —
  the service-account key (`FIREBASE_ADMIN_*`) is in place and working (the
  reference freeze and the live pool fetch are real DB writes that succeeded).
  `capture/.env.local` also holds `DREAMTEAM_USER_ID` (the account UUID used as
  the `/players` `userId`). See §6 for key regeneration if ever needed.
- **Auth vs data are two different Firebase projects (capture app).** The capture
  app authenticates its login against the **`dtcapture26`** project via the
  `NEXT_PUBLIC_AUTH_*` vars (consumed in `src/lib/firebase.ts`), while all player
  and manager **data** lives in `footieteamz27` (`NEXT_PUBLIC_DB_*` +
  `FIREBASE_ADMIN_*`). This is deliberate and working, but the login project is
  stale-named — see the migration to-do in §5.
- **Structure** (unchanged from last season):
  - `/0` — array of managers, each with `teamDetails[]` of picked players.
  - `/1/playerData` — full player pool.
  - `/2/0` — last-updated timestamp.
- **Rules:** `{ ".read": true, ".write": "auth != null" }`.
- **Seeded** with a copy of last season's `footieteamz26` export (28 managers, 609
  players) for testing. Clear `/0` and `/1/playerData` before the real season.
- **Clubs (2026/27):** 20 teams. Promoted sides **Coventry (COV), Hull (HUL),
  Ipswich (IPS)** replace last season's Burnley / West Ham / Wolves.

Full migration detail lives in `capture/SPECIFICATION-2027-data-migration.md`.

---

## 2. Capture app (`capture/`)

- Next.js 15.3.3, React 19, Tailwind v4, TypeScript. Hosts on **Vercel** (free tier).
  Repo `cjcloud/dreamteam27-capture` (private); push to `main` auto-deploys.
- **Data source:** the authenticated backend API
  (`engagecraft-fantasy-backend-prod.azurewebsites.net`). The old unauthenticated
  `players.json` feed is gone.
  - `src/app/api/players/route.ts` — server route: reads a Bearer token from the
    request, checks expiry, resolves the active tournament calendar, then fetches
    the full pool in ONE call to **`/players`** (not `/players/stats`) — 514
    players in `data.items`, no pagination — and normalises them (UUID `id`,
    `optaPersonId`, `playerClub`, un-scaled `price`, derived `status`). Never logs
    the token. **This is governed by the authoritative, change-controlled contract
    `capture/docs/API-CONTRACT-player-retrieval.md` — do not change the endpoint,
    params, auth, or field mapping without its sign-off + test process.**
  - `src/lib/utils.ts` — `PL_CLUB_BY_FLAG` (verified 20-club map),
    `getClubFromFlag`, `decodeJwtPayload` / `isJwtExpired`, and the updated
    `translatePlayerData`.
  - `src/lib/types.ts` — `playerId` is now a string (UUID).
- **Auth (login):** Firebase Auth against the **`dtcapture26`** project
  (`src/lib/firebase.ts`, `NEXT_PUBLIC_AUTH_*`). Separate from the data project;
  see §5 for the planned migration.
- **Token entry:** via the UI (Upload → "Fetch from API" tab). Paste a fresh
  Bearer token; it's validated (expiry countdown), held for the session only, sent
  as `Authorization: Bearer`, and cleared + re-prompted on a 401. Login uses email
  2FA every time, so the token is manual (roughly once a day).
- **Club shirts:** `ClubShirt` component maps club code → `/shirts/{KEY}.webp`
  (outfield) or `{KEY}_GK.webp` (goalkeeper), with an initials fallback. Wired into
  the search results and selected-players lists. Files live in
  `capture/public/shirts/`.
- **Theme:** still has `prussian` / `aquamarine` with a switcher (default
  aquamarine). Not reduced to a single theme (that was display-only).

---

## 3. Display app (`display/`)

- Next.js 13.5.11, React 18, Tailwind v3, TypeScript. Deploys to **Vercel**
  (free tier). Repo `cjcloud/dreamteam27-display` (private); push to `main`
  auto-deploys. **(Was previously slated for Firebase Hosting — corrected
  2026-08-15: both apps now on Vercel.)**
  - The app currently sets `output: 'export'` (static export) in
    `next.config.js`. Vercel serves static exports fine, so this can stay — but
    **verify** on the first deploy, or drop `output: 'export'` to use Vercel's
    Next.js runtime instead. Tracked in §5.
- **Database pointer:** `.env.local` `NEXT_PUBLIC_FIREBASE_DATABASE_URL` →
  `footieteamz27` (reads are public). Display needs **only** the public DB config
  — no `AUTH_`, `DREAMTEAM_USER_ID`, or `FIREBASE_ADMIN_*` vars.
- **OneDrive fix:** `next.config.js` uses polling-based file watching so
  `npm run dev` doesn't hang inside the synced folder.

### 3.1 Theme — single "neon" theme

Defined as CSS variables on `:root` in `app/globals.css` (other palettes removed,
theme switcher removed). Legacy Tailwind colour names (`onyx`, `payne`, `munsell`,
`munsell-dusk`, `tangerine`, `timber`) map to these tokens in `tailwind.config.js`,
so components re-colour automatically.

| Token | Hex | Role |
|-------|-----|------|
| `--dt-bg` | `#0A0A0A` | Page background (near-black) |
| `--dt-surface` | `#334155` | Slate card surface |
| `--dt-surface-2` | `#1B4D3E` | **Banner / bands** (Sherwood green, `hsl(162 48% 20%)`) |
| `--dt-primary` | `#4361EE` | Buttons / links (blue) |
| `--dt-primary-contrast` | `#FFFFFF` | Text on primary |
| `--dt-accent` | `#C7F900` | Highlight (electric lime — the "Team" in the logo) |
| `--dt-content` | `#F2F2F2` | Main text |
| `--dt-content-muted` | `#6CABDD` | Muted text (sky) |
| `--dt-border` | `#26262E` | Borders |

Notable specifics:
- Nav banner = Sherwood green; logo "Team" and the team-card position circle = lime.
- Winners text (2nd/3rd place) = medium blue `#2563EB`.

### 3.2 Tables — fixed light "mint" scheme (theme-independent)

The standings-style tables use fixed light colours (not theme tokens) so they stay
clean and readable on the dark page. Applied to `LeagueTable`, the analysis
player-search table, and the `TeamCard` player lists.

| Element | Hex |
|---------|-----|
| Outer frame | `#BFE6CF` |
| Header band / column header | `#C8EAD6` / `#DCF3E6` |
| Rows (zebra) | `#FFFFFF` / `#F5F6F7`, hover `#E9F5EE` |
| Text (cells / totals) | `#33414A` / `#2E3A40` |
| Muted (last-updated) | `#5B6770` |

### 3.3 Routing & chrome

- **Root `/` = Teams** (the landing view). `app/page.tsx` renders the Teams page.
- **Former home page preserved at `/review`** — hidden (no nav link), kept for
  end-of-season use. Still shows last season's "26" branding, to be updated later.
- **Nav:** Teams, League, Analysis (Home link removed). Logo → root.
- **App icon:** `app/icon.svg` (a copy of `football27.svg`) via Next's file
  convention; served at `/icon.svg`.

---

## 4. How to run

**Display app (view the site):**
```
cd C:\Users\CJ\OneDrive\projects\dreamteam27\display
npm install        (first time)
npm run dev        (open http://localhost:3000)
```

**Capture app (admin / data fetch):**
```
cd C:\Users\CJ\OneDrive\projects\dreamteam27\capture
npm install
npm run dev
```

Copy a command's text only — don't paste terminal output back into the shell.
If `npm run dev` acts oddly after config/import changes: stop it, delete `.next`
(`Remove-Item -Recurse -Force .next`), and restart.

---

## 5. Open items / to-do

- **Vercel setup (in progress):** import both repos, add env vars, set domains
  (`dreamteam27.info` → capture, `dreamteam27.co.uk` → display). See §11.
- **Migrate capture auth off `dtcapture26` (post-launch):** the capture login
  initialises Firebase Auth against the old **`dtcapture26`** project via
  `NEXT_PUBLIC_AUTH_*` (`src/lib/firebase.ts` lines 13–18), while data lives in
  `footieteamz27`. Deliberate and working, but a stale cross-season dependency
  for a single-user admin app. Plan: create the Auth config in `footieteamz27`
  (or a dedicated current project), repoint `NEXT_PUBLIC_AUTH_*` +
  `src/lib/firebase.ts`, verify login, then retire the dtcapture26 config.
  **Not a launch blocker.** Lower stakes than the admin-key rotation — these are
  public web-config strings, not a master credential; real access control is the
  project's Auth settings + the DB rules.
- **Display static-export on Vercel:** confirm `output: 'export'` serves correctly
  on Vercel on first deploy, or drop it to use Vercel's Next.js runtime (§3).
- **Deploy configs:** legacy `.firebaserc` / `firebase.json` / hosting targets are
  no longer the deploy path (both apps on Vercel) — clean up or ignore.
- **Display — unthemed pages:** `playerstatus`, `test-wissa`, and `winners` still
  use some light `slate/white` surfaces; theme them if you want full neon coverage.
- **`/review`** content still references 2025/26 — update when it's revived.
- **Pre-season reset:** empty `/0` (and `/1/playerData`) before the season starts.
- **Token:** manual paste (~daily) — inherent to the site's email-2FA login.

### Done
- Both apps' Realtime Database endpoints + web config → `footieteamz27` (reads verified).
- Capture writes verified live against `footieteamz27` (service-account key in place).
- Removed stale `serviceAccountKey.json` and the throwaway test scripts
  (`simple-firebase-test.js`, `test-wissa-*.js`, `scripts/`).
- **Old `footieteamz26` service-account key revoked** (2026-08-15) — see §12.
- **Both apps pushed to separate private GitHub repos** (2026-08-15) — see §11.

---

## 6. Generating the `footieteamz27` service-account key (for capture writes)

1. Firebase console → select the **`footieteamz27`** project.
2. Gear icon → **Project settings** → **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**. A JSON file downloads.
   Keep it private — never commit it or paste it into chat.
4. Open the JSON; it contains `project_id`, `client_email`, and `private_key`.
5. In `capture/.env.local`, set the three admin vars:
   ```
   FIREBASE_ADMIN_PROJECT_ID=footieteamz27
   FIREBASE_ADMIN_CLIENT_EMAIL=<client_email from the JSON>
   FIREBASE_ADMIN_PRIVATE_KEY="<private_key from the JSON — keep the \n and the quotes>"
   ```
6. Restart the capture dev server. Writes (Upload → Fetch from API, and manager
   updates) now authorize against `footieteamz27`.

In Vercel, the same three vars go into the capture project's Environment Variables
(paste values directly into Vercel — never commit them). The
`FIREBASE_ADMIN_PRIVATE_KEY` line breaks / `\n` must survive intact, or the
`/api/players` route throws an invalid-PEM error.

No Authentication product or user needed — the Admin SDK writes with the service
account directly. Stays on the free (Spark) plan.

---

## 7. Fix log — team-selection rules

The capture app was only enforcing the 11-player count; budget and formation were
display-only. Both now enforced, at two layers:

- **Entry stage** (`components/managers/search-results.tsx`, `handleAddPlayer`) —
  hard-blocks an add, with a toast advisory, if it would break: 11-player cap,
  position maximums (GK 1, DEF 5, MID 5, STR 3), or the £50M budget. No duplicates
  (already guarded).
- **Save stage** (`components/managers/selected-players.tsx`) — hard-blocks the
  save, with a combined advisory naming every failed rule: exactly 11 players,
  exactly 1 GK, an allowed formation (`ALLOWED_FORMATIONS` in `lib/constants.ts`:
  4-4-2, 4-3-3, 4-5-1, 3-4-3, 3-5-2, 5-4-1, 5-3-2), and value ≤ £50M. The exact
  formation can only be validated here since it depends on all 11 picks.

Also fixed: the selected-players table had its **Pos / Club columns swapped**
(pre-existing) — the club was rendering under "Pos" and the position under "Club".
Cells now match the headers.

Note: 5 defenders is legal (5-4-1, 5-3-2), so it's accepted; only exceeding a
maximum, the budget, or finishing on a disallowed formation is blocked.

---

## 8. Team-builder / analysis page (capture app)

New page at `/builder` (nav link "Builder"). Spec: `SPECIFICATION-analysis-team-builder.md`.

- Reads the player pool and shows per-position indicators: total points 25/26,
  points-per-£, European club, and a manual 1–5 starter rating.
- Adjustable weighting sliders produce a live composite score (normalised within
  each position group); sortable, filterable by position.
- Build a squad from the table with the same hard-block rules (11 / 1 GK / allowed
  formation / £50M), then save under a manager name — writes the canonical
  `teamDetails` shape so it shows in the display like any captured team.
- **European clubs are user-selectable**, not hardcoded: a panel of toggles drawn
  from the clubs present in the pool (auto-adapts each season). Saved to
  `/config/europeanClubs` (`EUROPEAN_CLUBS_PATH`) and kept in the browser as a
  fallback. Re-select each season during setup — no code change.
- **This selection is the authoritative optimiser input** (single source of
  truth) — see below. It is a *controlled, observable* input: the Builder always
  shows the active list, its provenance (`saved to database` / `this browser
  only` / `default (not set)`), and an `unsaved changes` flag when edits aren't
  yet written to the DB. The active list is also logged to the console on load
  (`[builder] European clubs (optimiser pool) loaded from <source> …`). Load
  order is database → browser → default seed.
- Config lives in `lib/constants.ts`: `EUROPEAN_CLUBS` (default seed),
  `EUROPEAN_CLUBS_PATH`, `SCORE_FACTORS`, `ALLOWED_FORMATIONS`.

Table controls:

- Every column is sortable (click header; dim ↕ hint, active ▲/▼), and the price /
  points / £ columns are properly aligned.
- "Table: European only" checkbox filters the **table view** to European clubs;
  scores stay relative to the full position group (the filter only hides rows).
  This is a view filter **only** — it does not affect the optimiser.

Auto-pick optimiser (exact, not a heuristic):

- Finds the **optimal XI** for a formation — maximise last-season (25/26) points
  with current (26/27) prices summing to ≤ £50M. Implemented as a grouped
  knapsack solved by dynamic programming over a 0.1M-discretised budget
  (`chooseExactK` + max-plus `combine`); runs in a few ms over the whole pool.
- Formation selector: a button per allowed formation reruns the solver for that
  shape; **Best overall** solves all seven and applies the highest-scoring legal
  team, naming the winning formation.
- **The optimiser ALWAYS restricts its candidate pool to the confirmed European
  clubs** — the curated `/config/europeanClubs` list is a hard constraint, not a
  toggle. If that list is empty it refuses to run with a clear message. (This
  replaced an earlier design where a separate, easily-missed checkbox decided
  whether the European selection was honoured — which let non-European players,
  e.g. Newcastle's, into optimised teams.)
- Result replaces the squad (with a confirm); a toast reports points and value.

Season-setup controls (on the page):

- **Freeze from current pool** → writes the read-only `2025/26` reference; shows a
  green "DATA FROZEN FOR: 2025/26" badge and switches to "Freeze again" (with an
  "Are you sure?" confirm) once frozen.

Data note: the Builder reads current price from `/1/playerData` (live) and
last-season points from the frozen reference joined by name — see §10 for the full
data model and the once-per-season order.

---

## 9. Fix log — save shape and season-update safeguards

- **Consistent team shape.** The capture "Confirm Team" flow saved a flat `players`
  array, but the display, seeded data, capture editor, and builder all use
  `teamDetails` / `playerDetails`. `selected-players.tsx` now writes `teamDetails`,
  so captured teams render their players in the display. (Teams saved earlier in the
  old shape would need a re-save/migration — currently none exist.)
- **playerValue locked at selection.** A pick's value is set only at team
  create/edit and is intentionally preserved by the season update
  (`update-manager.tsx`) — points/status refresh, value does not. Documented in code
  so a future change won't break it.
- **playerClub no longer corrupted on update.** The update loop used
  `getClubName(squadId)`, but `squadId` is a UUID this season, so it returned
  "NO CLUB" and overwrote the club. Removed; the update now preserves the stored
  club and only backfills a missing one from the resolved code.

---

## 10. Season data model (single source of truth)

All data lives in `footieteamz27`, with a clear separation between the live current
season, a frozen reference of last season, and a short rolling history of pulls.

| Path | What it is |
|------|-----------|
| `/1/playerData` | **Live** 2026/27 pool — refreshed by each API fetch (normalised). |
| `/0`, `/2/0` | Managers and last-updated (operational). |
| `/reference/2025-26/players` | **Frozen** 2025/26 reference — full player records, read-only after freezing. |
| `/history/players/current` | Last normalised pull (for rollback / diff). |
| `/history/players/previous` | The pull before it. |
| `/config/europeanClubs` | Season config (editable). |

Principles:

- **Live vs reference are separate.** A fetch only ever writes `/1/playerData` (and
  history); it never touches the reference. Last season's numbers can't drift.
- **The reference is the full records, frozen once.** Captured from the seeded pool
  *before* the first live fetch (Builder → "Freeze from current pool"), then never
  written again. Overwrite is guarded by a confirm.
- **History is the normalised pool, two deep.** Each fetch rotates
  `current → previous` and writes the new pull to `current` (and to `/1/playerData`).
  Enough to roll back a bad update or diff "what changed". Snapshots are small
  (~hundreds of KB), well within the Spark free tier.
- **Join key.** The Builder joins the live pool to the reference by player **name**
  this season (last season's data has no stable id). From next season, preserve the
  live data (which carries `optaPersonId`, stable across years) as the reference so
  the join can move onto that id.

Season-setup order (once per season):

1. While `/1/playerData` still holds last season's data → Builder → **Freeze from
   current pool** (writes `/reference/2025-26/players`).
2. Refresh the pool with a live 2026/27 fetch (Upload → Fetch from API). This brings
   in current prices, and the history rotation kicks in.
3. The Builder then shows current prices with last season's points (reference joined
   by name).

Paths live in `DB_PATHS` (`lib/constants.ts`): `REFERENCE_PLAYERS`,
`HISTORY_CURRENT`, `HISTORY_PREVIOUS`.

---

## 11. Git & deployment (Vercel, push-to-deploy)

Two apps, two **separate private** repos, two Vercel projects. Kept separate
deliberately: capture is a single-user admin surface holding write credentials and
server routes; display is public read-only. Isolating them keeps the admin secrets
out of the deployment the whole league can reach.

| App | Repo (private) | Vercel domain | Env vars |
|-----|----------------|---------------|----------|
| capture | `cjcloud/dreamteam27-capture` | `dreamteam27.info` | `NEXT_PUBLIC_AUTH_*`, `DREAMTEAM_USER_ID`, `NEXT_PUBLIC_DB_*`, `FIREBASE_ADMIN_*` |
| display | `cjcloud/dreamteam27-display` | `dreamteam27.co.uk` | `NEXT_PUBLIC_DB_*` **only** (no admin/auth secrets) |

- **Repos initialised & pushed (2026-08-15).** Each app got its own isolated
  `.git` (`git init` inside each folder). This mattered: `display/` had no repo of
  its own, so git commands there were operating on a huge **umbrella repo** above
  `projects/` that tracked unrelated projects *and* committed secrets — a
  `git push` from there would have published live keys. A fresh `git init` in
  `display/` isolated it. `.env.local` is gitignored in both (`.env*.local`), and
  each initial commit was verified to contain no secrets.
- **Push-to-deploy:** `main` is the production branch; pushes to `main`
  auto-deploy on Vercel, PRs get preview deploys.
- **Private repos + Vercel:** when importing, grant the Vercel GitHub app access
  to the two repos (Adjust GitHub App Permissions) — private repos won't appear
  until then. Source stays private; only the deployed site is public.
- **`FIREBASE_ADMIN_PRIVATE_KEY`:** paste into Vercel with line breaks / `\n`
  intact — the #1 cause of a broken `/api/players` route on deploy.
- **Optional hardening:** capture is admin-only — consider Vercel Deployment
  Protection (SSO in front of the whole deployment) or middleware, so the admin
  UI isn't reachable by anyone who finds `dreamteam27.info`.

### ⚠️ Separate cleanup (not part of dreamteam27)
The umbrella repo above `projects/` has committed `.env` files (e.g. Finance
SaaS) and a remote. If it's ever been pushed anywhere, treat those keys as
exposed and rotate them. Its own job — untangle when there's bandwidth.

---

## 12. Current state & next stage (handoff)

### Working / verified (as of 2026-08-15)

- **Live data pipeline works end to end.** A real token fetch pulls the 514-player
  2026/27 pool from `/players`, normalises it, rotates history, and writes to
  `/1/playerData`. The 2025/26 reference is frozen (609 players). DB reads and
  writes both confirmed against `footieteamz27`.
- **API retrieval is documented and locked** — `capture/docs/API-CONTRACT-player-retrieval.md`
  (authoritative, change-controlled). This underpins the app; treat it as the
  source of truth for how player data is fetched.
- **Both apps pushed to separate private GitHub repos**
  (`cjcloud/dreamteam27-capture`, `cjcloud/dreamteam27-display`), push-to-deploy
  ready. See §11.
- **Type-clean:** `npx tsc --noEmit` reports **0 errors**; `next build` passes.
  Note `next.config.js` still sets `typescript.ignoreBuildErrors` and
  `eslint.ignoreDuringBuilds` to `true` — optional to flip to `false` now that
  types are clean, so regressions fail the build.
- **Builder — European clubs are the authoritative optimiser input.** The
  optimiser ALWAYS restricts its XI to the confirmed European clubs (hard
  constraint, not a toggle). The active list, its provenance
  (database / browser / default), and an "unsaved changes" flag are shown in the
  UI and logged on load. Current DB value at `/config/europeanClubs`:
  `ARS, LIV, MAN C, MAN U, VILLA, SUN, PAL, BOU, BRI` (2026/27 qualifiers).

### Session log — 2026-08-15

- **Git workflow established.** Two isolated private repos created and pushed
  (§11). Caught and avoided the umbrella-repo-secret-push landmine (display had no
  local `.git`). Fixed a remote-URL typo on capture; resolved a "repository not
  found" (repo not yet created on GitHub) and a credential-cache re-auth.
- **Deployment target corrected.** Display was previously slated for Firebase
  Hosting; both apps now deploy to **Vercel**. Docs updated (§3, §11).
- **`footieteamz26` service-account key revoked.** Confirmed no code references
  `footieteamz26` (grep clean) and the Builder reads last season's data from the
  frozen `/reference/2025-26/players` inside `footieteamz27`, so revocation broke
  nothing. Closes the exposed-key item from the old launch checklist.
- **`dtcapture26` auth dependency documented.** Discovered the capture login
  authenticates against the old `dtcapture26` Firebase project
  (`NEXT_PUBLIC_AUTH_*`, `src/lib/firebase.ts`) while data lives in
  `footieteamz27`. Deliberate and working; migration to-do added (§5).
- **Documentation charter added** (top of this file): keeping this status doc
  current — progress, decisions, problem resolutions — is a core deliverable.

### Fixed earlier (prior session)

- Player-retrieval endpoint corrected to `/players` (+ `userId` UUID from
  `DREAMTEAM_USER_ID` env); response shape verified against a live 514-player payload.
- **UUID id crash fixed** — `capture-form.tsx` and `update-manager.tsx` no longer
  `Number()`-coerce UUID player ids (which produced `NaN` → react-use-cart
  "must provide an id"). Native string id kept; matches how search-adds create ids.
- Full TypeScript cleanup (~100 pre-existing errors → 0), incl. an incomplete
  `react-use-cart` type override and a `data-table` `Manager.name` view type.
- Optimiser made European-constrained + the selection made observable/controlled.

### Analysis note (validates the European constraint)

Using last season's frozen points: high scorers cluster heavily in European clubs.
~45% of all players are at a European club, but that rises to ~88–92% among the
top 25–50 scorers (and ~88% of all 200+ point players) — the premium is a
threshold effect concentrated above ~200 points. So constraining the optimiser to
European clubs costs almost nothing in achievable points.

### Next stage (launch checklist)

1. ✅ **Browser smoke test — PASSED (2026-08-14).** Full capture flow verified end
   to end. Checklist: `SMOKE-TEST.md`.
2. ✅ **Repos + security (2026-08-15).** Separate private repos pushed; exposed
   `footieteamz26` key revoked.
3. **Vercel deploy (in progress).** Import both repos → add env vars → set domains
   (`dreamteam27.info` capture, `dreamteam27.co.uk` display). Both free tier, both
   push-to-deploy on `main`. See §11.
4. **Pre-season reset** — before the real season, clear `/0` (managers) and
   `/1/playerData`, keeping structure/rules; re-freeze the reference if needed.
   **Back up `/0` and `/1/playerData` first** (irreversible).
5. **Display app** — finish neon theming on the remaining pages; verify it reads
   `footieteamz27` and renders the new teams/prices; confirm static-export behaviour
   on Vercel (§3).
6. **Post-launch** — migrate capture auth off `dtcapture26` (§5); optionally flip
   `ignoreBuildErrors`/`ignoreDuringBuilds` to `false`; rotate the umbrella-repo
   secrets (§11 cleanup note).

_Last updated: 2026-08-15._
