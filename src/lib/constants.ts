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
  HISTORY_PREVIOUS: '/history/players/previous'
};

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
