# 🔒 API CONTRACT — Player Data Retrieval (AUTHORITATIVE)

> **STATUS: LOCKED / AUTHORITATIVE.** This document is the single source of truth
> for how DreamTeam27 retrieves player data from the authenticated Dream Team FC
> backend. **The player pool underpins the entire app** — team selection, budget
> enforcement, the Builder, the optimizer, and the public display all depend on
> it being correct.
>
> **Do not change the API contract (endpoint, parameters, auth, or the field
> mapping) without following the [Change Control](#12-change-control--required-authority)
> process at the bottom of this document.** Casual edits have silently broken
> this pipeline before (the working logic was lost once already). Every change
> must pass the [Mandatory Test Procedure](#11-mandatory-test-procedure-run-before-any-change)
> and be signed off.

**Owner:** CJ · **Last verified:** 2026-08-14 against a live 514-player payload · **Season:** 2026/27

---

## 1. Why this matters (read first)

The 2025/26 unauthenticated `players.json` feed is **dead**. For 2026/27 the only
source of player data is the site's **private, authenticated backend API**. If
this retrieval is wrong, the failure is often *silent and destructive*, not a
crash:

- Wrong price field → **every price becomes £0** → the £50M budget rail is
  meaningless and any team "fits".
- Wrong club mapping → **"Unknown" clubs** → shirts, filters, and the European
  indicator break.
- Wrong endpoint → **HTTP 400** and no data at all (this is the failure that
  cost us the working logic once).

Because these break quietly, **changes here require testing and sign-off, not
just a code review.**

---

## 2. The retrieval flow (end to end)

```
Capture UI (/upload)                Next.js server route            Dream Team backend (Azure)
─────────────────────               ────────────────────           ──────────────────────────
paste Bearer token
click "Fetch"
  │  GET /api/players
  │  Authorization: Bearer <token>
  ▼
                          route.ts:
                          1. validate token (well-formed, not expired)
                          2. read userId from DREAMTEAM_USER_ID env
                          3. GET /tournament-calendars/active ───────▶ { data: { … id } }
                          4. GET /players?tournamentCalendarId=…&
                             type=gameweek&limit_fixture=3&userId=… ─▶ { data: { items: [514] } }
                          5. normalise() each item
                          ◀── returns a plain array of normalised players
  ▼
processJsonData():
  - validate each player (id, displayName, position)
  - rotate history (current → previous), write new → current
  - translatePlayerData() → playerDetails shape
  - write pool to Firebase /1/playerData
  - write timestamp to /2/0
```

Two apps, one database. **Only the capture app fetches.** The display app only
reads Firebase; it never touches this API.

---

## 3. Endpoint contract (EXACT — do not alter without sign-off)

Base URL:

```
https://engagecraft-fantasy-backend-prod.azurewebsites.net/api
```

### 3.1 Resolve the active season calendar

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/tournament-calendars/active` |
| **Headers** | `Authorization: Bearer <token>`, `accept: application/json` |
| **Returns** | `tournamentCalendarId` — read from `data.tournamentCalendarId`, falling back to `data.id`, then top-level `tournamentCalendarId` |

This id **changes every season**. It is fetched at runtime, never hardcoded, so
a new season needs no code change here.

### 3.2 Fetch the player pool  ← the critical call

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/players` &nbsp;**(NOT `/players/stats`)** |
| **Query** | `tournamentCalendarId=<from 3.1>` · `type=gameweek` · `limit_fixture=3` · `userId=<account UUID>` |
| **Headers** | `Authorization: Bearer <token>`, `accept: application/json` |
| **Pagination** | **None.** All players return in one response under `data.items`. |
| **Verified size** | 514 players (2026/27, 20 clubs) |

Proven-good request (captured live, HTTP 200):

```
GET /api/players?tournamentCalendarId=be2cf2c1-42ad-4aa2-8156-692b2bf03b09
                &type=gameweek
                &userId=747e361a-7b5b-4cfd-b696-09e534c96117
                &limit_fixture=3
```

> ⚠️ **`/players/stats` is a DIFFERENT endpoint** (gameweek stats, paginated,
> `sortBy`/`sortDir`/`page`/`limit`). It **rejects the pool request with HTTP 400**
> pre-season and is **not** the pool source. Using it was the original bug.
> **The pool comes from `/players`.**

---

## 4. Authentication & identity

### 4.1 Bearer token
- A standard JWT, lifetime **exactly 24 hours** (`iat`→`exp`).
- Supplied **manually** through the capture UI — auto-login is impossible because
  the site uses Auth0 with **email 2FA on every login**.
- Held in browser `sessionStorage` (`dtfc-token`) for the session only; **never
  written to disk, never committed, never logged.**
- Validated client-side (well-formed + `exp` in the future) *and* server-side
  before use. A `401` from Azure clears the stored token and re-prompts.

### 4.2 `userId` — the trap that cost us the logic
- `/players` requires **`userId` = the account UUID** (e.g.
  `747e361a-7b5b-4cfd-b696-09e534c96117`).
- **This is NOT the token's `sub` claim.** The token `sub` is a small numeric id
  (e.g. `1423`) — an *unrelated* value. Sending `sub` as `userId` yields **HTTP 400**.
- The UUID is **stable across logins**, so it is stored once in the server-only
  env var **`DREAMTEAM_USER_ID`** (in `.env.local`, never `NEXT_PUBLIC_`).

### 4.3 How to obtain a fresh token (roughly once a day)
1. Log in at `fantasy.dreamteamfc.com` (clears the email 2FA for 24h).
2. DevTools (`F12`) → **Network** tab → filter `azurewebsites`.
3. Click any `/api/...` request → **Headers** → **Request Headers**.
4. Copy the `authorization` value **after `Bearer `** (the raw token only — no
   `Bearer `, no quotes, no `token:` prefix).
5. Paste it into the token field on `/upload` and click **Fetch**.

---

## 5. Response shape (verified 2026-08-14)

```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "dddab4b6-c7c9-449d-ae1d-1200dc3d1709",  // ← player UUID (USE THIS)
        "optaPersonId": "9hg51o20uf6u2bjgshjax9soa",    // ← stable cross-season join key
        "firstName": "Elliot Karl",
        "lastName": "Stroud",
        "displayName": "E. Stroud",
        "position": "DEF",                               // GK | DEF | MID | STR
        "contestantFlagKey": "HUL",                      // ← club key (see §7)
        "teamName": "Hull City AFC",
        "price": 2,                                       // ← UN-SCALED (£2.0m). NOT micro-units.
        "totalPoints": 0,                                 // 0 pre-season
        "gameweekPoints": 0,
        "averagePoints": 0,
        "percentSelected": 0.08,
        "availabilityDisplay": "available",               // → status
        "injuryDetails": null,                            // → status
        "suspensionDetails": null,                        // → status
        "currentPeriodFixtures": [ … ],
        "nextFixtures": [ … ]
      }
      // … 514 total
    ]
  }
}
```

The player list is under **`data.items`** (an array). There is **no `pagination`
object** on `/players`.

---

## 6. Field mapping (API → `normalise()` → DB `playerDetails`)

`route.ts::normalise()` converts each API item; `utils.ts::translatePlayerData()`
then writes the DB `playerDetails` shape. **Do not change either without re-running
the test procedure.**

| DB field (`playerDetails`) | API field | Rule |
|---|---|---|
| `playerId` | `id` | UUID **string** (`/players` uses `id`, not `playerId`) |
| `playerName` | `displayName` | passthrough |
| `playerPosition` | `position` | `GK` / `DEF` / `MID` / `STR` |
| `playerClub` | `contestantFlagKey` → `getClubFromFlag()` | see §7 |
| `playerValue` | `price` | **un-scaled — NEVER divide by 1,000,000** (see §8.3) |
| `gwpts` | `gameweekPoints ?? 0` | |
| `gwtotalPts` | `totalPoints` | |
| `playerinjured` | `injuryDetails != null` | |
| `playerSuspended` | `suspensionDetails != null` | |
| `playereliminated` | `availabilityDisplay` (non-`available`) | |
| `playerDNP` | `status==='playing' && gameweekPoints===null` | |
| _(carried, not yet in DB)_ | `optaPersonId` | reserved for the cross-season join |

---

## 7. Club map — 20 clubs, flag key → app code

`utils.ts::PL_CLUB_BY_FLAG`. Verified: **exactly these 20 keys** appear in the
2026/27 pool, **zero fall back to "Unknown".**

| API key | App code | | API key | App code |
|---|---|---|---|---|
| ARS | ARS | | LEE | LEE |
| AVL | VILLA | | LIV | LIV |
| BHA | BRI | | MCI | MAN C |
| BOU | BOU | | MUN | MAN U |
| BRE | BRE | | NEW | NEW |
| CHE | CHE | | NFO | FOR |
| **COV** | **COV** (promoted) | | SUN | SUN |
| CRY | PAL | | TOT | SPURS |
| EVE | EVE | | **HUL** | **HUL** (promoted) |
| FUL | FUL | | **IPS** | **IPS** (promoted) |

Promoted sides **COV / HUL / IPS** replace last season's Burnley / West Ham /
Wolves. **Each season, re-verify this list** (see §13) — an unmapped key silently
becomes "Unknown".

---

## 8. Invariants — the rules that must never be broken

These are the pieces of logic that are easy to lose. Treat each as load-bearing.

**8.1 Endpoint** — the pool comes from **`/players`**, never `/players/stats`.

**8.2 `userId`** — the **account UUID** from `DREAMTEAM_USER_ID`, **never** the
token `sub`.

**8.3 Price is un-scaled** — the API returns human values (`2`, `2.5`, `8.5`).
**Do not divide by 1,000,000.** `translatePlayerData` divides only if a value is
implausibly large (`> 1000`), purely to tolerate legacy micro-unit data; new API
prices must pass through untouched.

**8.4 Player id** — read from **`id`** (`/players`), kept as a **string** UUID.

**8.5 No pagination** — one call returns all players under `data.items`. Do not
re-introduce a paging loop for `/players`.

**8.6 `playerValue` is locked at selection** — a player's pick price is frozen
when a manager selects them. **Data-retrieval refreshes must NOT overwrite the
`playerValue` of already-picked players.** (Enforced in `update-manager.tsx`.)

**8.7 Token hygiene** — never log the token; never persist it to disk; never put
it in a `NEXT_PUBLIC_` var or a query string.

---

## 9. Timeouts & error handling

| Layer | Guard | On failure |
|---|---|---|
| Client (`handleApiFetch`) | 90s `AbortController` | toast "Timed out after 90s…" |
| Server → Azure (each fetch) | 25s `AbortSignal.timeout` | 504 with a timeout message |
| Server → Firebase (`dbService`) | 30s `AbortSignal.timeout` | toast DB error |

The server returns `{ message, error }`; the client surfaces `error` first (the
specific reason), then `message`. A `401` anywhere clears the token and
re-prompts. The terminal logs `[api/players] fetch failed: <reason>` (token
redacted) for diagnosis.

---

## 10. Rolling history (rollback safety)

Before writing a new pool, `processJsonData` rotates snapshots so a bad pull can
be rolled back and updates can be diffed:

```
/history/players/previous  ← (old) /history/players/current
/history/players/current   ← new pull
/1/playerData              ← new pull (the live pool)
/2/0                       ← last-updated timestamp
```

History failures are non-fatal (logged, upload continues).

---

## 11. Mandatory test procedure (run before ANY change)

**No change to this contract ships without all of these passing.**

1. **Live fetch** — with a fresh token, click **Fetch** on `/upload`. Expect the
   toast **"Fetched 514 players — saving…"** (count may shift as squads change,
   but must be ~500–520, never 0).
2. **Non-zero pool** — the route throws on `0 items`; confirm you did not trip it.
3. **Price sanity** — spot-check in the Builder: prices sit in **£1.5–8.5m**,
   never £0. (Regression anchor: **Haaland = £8.5m, Man C, STR**.)
4. **Club completeness** — assert **exactly 20 distinct clubs, zero "Unknown"**.
5. **Positions** — every player is one of `GK/DEF/MID/STR`.
6. **End-to-end** — capture one manager team, confirm it saves to `/0` and the
   **display app renders it**.
7. **Type-clean build** — `npm run build` and `npx tsc --noEmit` both pass.

A standalone verification of steps 3–5 against a saved `response.txt` payload:

```python
import json
d = json.load(open('response.txt'))
items = d['data']['items']
from collections import Counter
clubs = {PL_CLUB_BY_FLAG.get((p.get('contestantFlagKey') or '').upper(), 'Unknown') for p in items}
assert 'Unknown' not in clubs, 'unmapped club key!'
assert len(clubs) == 20, clubs
assert all(p['position'] in ('GK','DEF','MID','STR') for p in items)
assert all(1.5 <= (p['price'] if p['price'] <= 1000 else p['price']/1e6) <= 20 for p in items)
print('OK', len(items), 'players', len(clubs), 'clubs')
```

---

## 12. Change control — required authority

Changing the endpoint, its parameters, the auth/`userId` sourcing, or the
`normalise()`/`translatePlayerData()` field mapping is a **breaking change**.

To make such a change:

1. **Get explicit owner sign-off (CJ).** State *what* is changing and *why*.
2. **Capture a fresh live payload** (`response.txt`) proving the new shape.
3. **Run the full [Mandatory Test Procedure](#11-mandatory-test-procedure-run-before-any-change)**
   and paste the results into the PR / change note.
4. **Update this document** (the tables, the "Last verified" date, and the
   regression anchors) in the same change.
5. Only then merge.

Edits that skip these steps should be reverted on sight. The code guards this
with a banner comment at the top of `route.ts` pointing here.

---

## 13. Season rollover checklist

At the start of each new season, **before go-live**:

- [ ] Fresh token; run a **live fetch** and save the new `response.txt`.
- [ ] Re-confirm the **20 club keys** (§7). Promoted/relegated sides change 3 keys
      most seasons — update `PL_CLUB_BY_FLAG` for any new key, or it becomes
      "Unknown".
- [ ] Confirm `/tournament-calendars/active` returns the **new** id (it should,
      automatically — do not hardcode).
- [ ] Confirm `DREAMTEAM_USER_ID` is still valid (it is account-stable; only
      changes if the account changes).
- [ ] Re-run the **Mandatory Test Procedure**.
- [ ] Freeze the previous season's pool as the reference set, then clear `/0`
      (managers) for the new season.

---

## 14. File map

| Concern | File |
|---|---|
| API fetch + normalise (server) | `capture/src/app/api/players/route.ts` |
| Club map + `translatePlayerData` + JWT helpers | `capture/src/lib/utils.ts` |
| Client fetch + history rotation + DB write | `capture/src/components/upload/file-upload.tsx` |
| DB write transport (timeouts) | `capture/src/lib/db-service.ts` |
| DB paths / constants | `capture/src/lib/constants.ts` |
| Account UUID + admin creds | `capture/.env.local` (`DREAMTEAM_USER_ID`, `FIREBASE_ADMIN_*`) |
| This contract | `capture/docs/API-CONTRACT-player-retrieval.md` |
| Migration background | `capture/SPECIFICATION-2027-data-migration.md` |

---

_When in doubt, this document wins. If the code disagrees with this contract, the
code is the bug until this document is updated through Change Control._
