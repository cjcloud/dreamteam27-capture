# Specification: analysis team-builder page (capture app)

A new page that surfaces per-player performance indicators by position, scores
players with adjustable weightings, and lets you build a team under a manager
name — experiment freely, then save (enforcing the squad rules).

## Decisions (confirmed)

- **Location:** new page in the capture app (reuses the player pool, rules, and
  save-to-database flow).
- **Output:** experiment freely; optionally save the finished team to `/0` under a
  manager name, enforcing 11 players / 1 GK / allowed formation / £50M.
- **Scoring:** adjustable weighted sliders → live composite score.
- **Data source for indicators:** last season's `footieteamz26` data (per player:
  `totalPoints`, `price`, `position`, `playerClub`).

## Indicators

| Indicator | Source | Notes |
|-----------|--------|-------|
| Total points 25/26 | `totalPoints` from the pool | Direct. |
| Points per £ | `totalPoints ÷ (price in £M)` | Value efficiency. |
| European club | `EUROPEAN_CLUBS` list (`lib/constants.ts`) | Editable; boolean per player's club. |
| Starter security | — | Last-season data has no minutes; **v1 = optional manual 1–5 rating** (defaults neutral). True minutes-based scoring needs the richer live API (future upgrade). |

## Composite score

- Each factor is normalised to 0–100 within the current position group
  (min–max for points and points-per-£; boolean 100/0 for European; rating→0–100
  for starter security).
- `score = Σ (normalisedFactor × weight)`, weights from the sliders normalised to
  sum 100% (`SCORE_FACTORS` in `lib/constants.ts` holds keys + default weights).
- Table is sortable by any column or by score; filterable by position (GK/DEF/MID/STR).

## Squad build + save

- Add players into a squad from the table. Running formation, budget, and total
  score shown.
- Same hard-block rules as the capture flow: exactly 11, exactly 1 GK, an allowed
  formation, total ≤ £50M — with advisories.
- Save writes to `/0` under the entered manager name (reusing the existing save
  shape), so it appears in the league/display like any captured team.

## Data caveats

- **Season transition:** right now `/1/playerData` *is* last season's seeded data,
  so indicators read directly from the pool. Once a live 2026/27 fetch replaces the
  pool (UUID ids, 0 pre-season points), the 25/26 indicators must come from a
  **stored last-season snapshot joined by player name** (ids differ across seasons).
  Plan: persist a last-season stats map (name → totals) and look up per current
  player. Flagged for the follow-up once live data lands.
- **Starter security** is manual in v1 (no minutes in the footieteamz26 data).

## Files (planned)

- `src/lib/constants.ts` — `EUROPEAN_CLUBS`, `SCORE_FACTORS` (done).
- `src/app/builder/page.tsx` — the page (analysis table + scoring + squad + save).
- Nav link in `src/components/nav/navbar.tsx`.
- Reuses `ALLOWED_FORMATIONS`, `APP_CONSTANTS`, and the club-shirt component.

_Last updated: 2026-08-13._
