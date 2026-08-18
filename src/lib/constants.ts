// Firebase database paths
export const DB_PATHS = {
  MANAGER_DATA: '/0',  // Changed from '/capture' to '/0'
  MANAGERS: '/0',
  PLAYER_DATA: '/1/playerData',  // current 2026/27 live pool (refreshed by API)
  LAST_UPDATED: '/2/0',
  // Frozen 2025/26 reference — full player records, read-only after freezing.
  REFERENCE_PLAYERS: '/reference/2025-26/players',
  // Rolling history of the last two normalised pool pulls.
  HISTORY_CURRENT: '/history/players/current',
  HISTORY_PREVIOUS: '/history/players/previous',
  // Restricted archive of (manager, mobile) pairs, collated from /0 by the
  // manual "Archive & sanitise" action (see /mobile-archive page and
  // /api/manager-mobile-archive route) before mobile numbers are wiped from
  // the live manager records. Read/write both require a verified Firebase
  // ID token — see verifyAdminRequest() in lib/firebase-admin.ts. This is
  // NOT protected by Realtime Database rules (the shared root rule is
  // public-read and can't be overridden for a sub-path — see
  // dreamteam27-manager's docs/SPEC-manager-app.md §11 for why); access
  // control here is enforced entirely at the API layer instead.
  MOBILE_ARCHIVE: '/secure/managerMobileArchive',
};

// The same registration/edit cutoff dreamteam27-manager retires at (see its
// docs/SPEC-manager-app.md §4/§11) — kept here as a literal rather than a
// cross-repo import since the two apps deploy independently. The mobile
// archive/sanitise action (see /mobile-archive and
// /api/manager-mobile-archive) is only meaningful once dreamteam27-manager
// has actually retired and mobile numbers have stopped changing, so both the
// UI and the API route gate on this same timestamp.
export const MOBILE_ARCHIVE_AVAILABLE_FROM_ISO = '2026-08-21T19:59:00+01:00';
export const MOBILE_ARCHIVE_AVAILABLE_FROM_MS = new Date(MOBILE_ARCHIVE_AVAILABLE_FROM_ISO).getTime();

export function isMobileArchiveAvailable(now: number = Date.now()): boolean {
  return now >= MOBILE_ARCHIVE_AVAILABLE_FROM_MS;
}

// Application constants
export const APP_CONSTANTS = {
  MAX_PLAYERS: 11,
  BUDGET_LIMIT: 50.0,
  MIN_MANAGER_NAME_LENGTH: 3
};

// Allowed outfield formations (DEF-MID-STR); every squad also has exactly 1 GK.
export const ALLOWED_FORMATIONS = [
  '4-4-2',
  '4-3-3',
  '4-5-1',
  '3-4-3',
  '3-5-2',
  '5-4-1',
  '5-3-2',
];

// --- Analysis / team-builder configuration ---

// Clubs qualified for European competition in 2026/27 (app club codes).
// DEFAULT IS A BEST GUESS — edit to match reality. Used as a performance
// indicator on the analysis page.
// Default seed only. The live list is user-editable on the Builder page and
// persisted to EUROPEAN_CLUBS_PATH so it can be reset each season.
export const EUROPEAN_CLUBS: string[] = [
  'ARS',    // Arsenal
  'LIV',    // Liverpool
  'MAN C',  // Manchester City
  'MAN U',  // Manchester United
  'CHE',    // Chelsea
  'SPURS',  // Tottenham
  'NEW',    // Newcastle
  'VILLA',  // Aston Villa
];

// Where the season's European-clubs selection is stored in the database.
export const EUROPEAN_CLUBS_PATH = '/config/europeanClubs';

// Composite-score factors and their default weights (%). Weights are adjustable
// live via sliders on the page; they are normalised to sum to 100% at runtime.
export const SCORE_FACTORS = [
  { key: 'totalPoints', label: 'Total points 25/26', defaultWeight: 40 },
  { key: 'pointsPerValue', label: 'Points per £', defaultWeight: 25 },
  { key: 'european', label: 'European club', defaultWeight: 15 },
  { key: 'starter', label: 'Starter security', defaultWeight: 20 },
] as const;
