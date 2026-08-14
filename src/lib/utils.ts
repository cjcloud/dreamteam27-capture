// Normalize accented characters for search including Nordic alphabet - CACHE BUST 2025-08-17-01:03
export const normalizeStringV3_CACHEBUST = (str: string): string => {
  console.log('🚀🚀🚀 NORMALIZE V3 CACHE-BUST CALLED:', new Date().toISOString(), str);
  
  const result = str
    .replace(/[\u00F8]/g, 'o')  // ø (248)
    .replace(/[\u00D8]/g, 'o')  // Ø (216) 
    .replace(/[\u00E6]/g, 'ae') // æ (230)
    .replace(/[\u00C6]/g, 'ae') // Æ (198)
    .replace(/[\u00E5]/g, 'a')  // å (229)
    .replace(/[\u00C5]/g, 'a')  // Å (197)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
  console.log('🚀🚀🚀 NORMALIZE V3 RESULT:', result);
  return result;
};

// Keep old function for backward compatibility
export const normalizeString = normalizeStringV3_CACHEBUST;

export const getClubName = (squadId: number): string => {
  switch (squadId) {
    case 1: return 'MAN U'
    case 2: return 'LEEDS'
    case 3: return 'ARS'
    case 4: return 'NEW'
    case 6: return 'SPURS'
    case 7: return 'VILLA'
    case 8: return 'CHE'
    case 11: return 'EVE'
    case 14: return 'LIV'
    case 17: return 'FOR'
    case 21: return 'WHAM'
    case 31: return 'PAL'
    case 36: return 'BRI'
    case 39: return 'WOL'
    case 43: return 'MAN C'
    case 49: return 'SHEF'
    case 54: return 'FUL'
    case 90: return 'BUR'
    case 91: return 'BOU'
    case 94: return 'BRE'
    case 102: return 'LUT'
    case 20: return 'SOU'
    case 13: return 'LEE'
    case 40: return 'IPS'
    case 56: return 'SUN'
    case 90: return 'BUR'
    default: return 'NO CLUB'
  }
}

// --- 2026/27 API club mapping -------------------------------------------------
// The authenticated API returns `contestantFlagKey` instead of a usable squadId
// (squadId is now a UUID). This maps the flag key to the app's club codes.
// VERIFIED against the full 517-player payload: exactly these 20 clubs are
// present for 2026/27. Note the season's promoted sides — Coventry (COV),
// Hull (HUL), Ipswich (IPS) — replace last season's Burnley/West Ham/Wolves.
// Unknown keys fall back to 'Unknown'.
export const PL_CLUB_BY_FLAG: Record<string, string> = {
  ARS: 'ARS',   // Arsenal
  AVL: 'VILLA', // Aston Villa
  BHA: 'BRI',   // Brighton & Hove Albion
  BOU: 'BOU',   // AFC Bournemouth
  BRE: 'BRE',   // Brentford
  CHE: 'CHE',   // Chelsea
  COV: 'COV',   // Coventry City (promoted)
  CRY: 'PAL',   // Crystal Palace
  EVE: 'EVE',   // Everton
  FUL: 'FUL',   // Fulham
  HUL: 'HUL',   // Hull City (promoted)
  IPS: 'IPS',   // Ipswich Town (promoted)
  LEE: 'LEE',   // Leeds United
  LIV: 'LIV',   // Liverpool
  MCI: 'MAN C', // Manchester City
  MUN: 'MAN U', // Manchester United
  NEW: 'NEW',   // Newcastle United
  NFO: 'FOR',   // Nottingham Forest
  SUN: 'SUN',   // Sunderland
  TOT: 'SPURS', // Tottenham Hotspur
}

export const getClubFromFlag = (flagKey?: string): string => {
  if (!flagKey) return 'Unknown'
  return PL_CLUB_BY_FLAG[flagKey.toUpperCase()] ?? 'Unknown'
}

// --- JWT helpers (client + server safe) --------------------------------------
export interface JwtPayload {
  sub?: string      // user id
  exp?: number      // expiry (seconds since epoch)
  iat?: number
  aud?: string
  [key: string]: unknown
}

// Decode the payload of a JWT without verifying the signature.
// Works in both the browser and the Next.js server runtime (atob is available
// in both). Returns null if the token is malformed.
export const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

// True if the token is missing/malformed or its exp is in the past.
export const isJwtExpired = (token: string): boolean => {
  const p = decodeJwtPayload(token)
  if (!p || typeof p.exp !== 'number') return true
  return p.exp * 1000 <= Date.now()
}

interface RawPlayer {
  id: number | string        // 2026/27: UUID string; legacy: numeric
  displayName: string
  position: string
  squadId?: number           // legacy only — new API has no squadId
  playerClub?: string        // new API path: club code already resolved
  contestantFlagKey?: string // new API path: raw flag key (fallback for club)
  gameweekPoints: number | null
  status: string
  totalPoints: number
  price: number
  injured?: boolean
  suspended?: boolean
  eliminated?: boolean
  // Additional possible field names for injury status
  isInjured?: boolean
  playerInjured?: boolean
  injury?: boolean
}

interface TranslatedPlayer {
  playerId: number | string
  playerDetails: {
    playerName: string
    playerPosition: string
    playerClub: string
    gwpts: number
    playerinjured: boolean
    playereliminated: boolean
    playerSuspended: boolean
    playerDNP: boolean
    gwtotalPts: number
    playerValue: number
  }
}


export const translatePlayerData = (players: RawPlayer[]): TranslatedPlayer[] => {
  return players.map(player => {
    // Debug Palmer specifically
    if (player.displayName && player.displayName.toLowerCase().includes('palmer')) {
      console.log('=== PALMER DEBUG ===');
      console.log('displayName:', player.displayName);
      console.log('All fields:', Object.keys(player));
      console.log('status:', player.status);
      console.log('injured:', player.injured);
      console.log('isInjured:', player.isInjured);
      console.log('playerInjured:', player.playerInjured);
      console.log('injury:', player.injury);
      console.log('Raw player object:', JSON.stringify(player, null, 2));
    }

    // Club: prefer the already-resolved code (new API path), then the flag key,
    // then the legacy numeric squadId.
    const club =
      player.playerClub ||
      (player.contestantFlagKey ? getClubFromFlag(player.contestantFlagKey) : undefined) ||
      (player.squadId !== undefined ? getClubName(player.squadId) : 'Unknown')

    // Price: the new API is already un-scaled (e.g. 2.5). Legacy data stored
    // micro-units (e.g. 3_300_000). Divide only when the value is clearly scaled.
    const playerValue = player.price > 1000 ? player.price / 1000000 : player.price

    return {
      playerId: player.id,
      playerDetails: {
        playerName: player.displayName,
        playerPosition: player.position,
        playerClub: club,
        gwpts: player.gameweekPoints ?? 0,
        playerinjured: player.injured ?? player.isInjured ?? player.playerInjured ?? player.injury ?? (player.status === 'injured'),
        playereliminated: player.eliminated ?? (player.status === 'eliminated'),
        playerSuspended: player.suspended ?? (player.status === 'suspended'),
        playerDNP: player.status === 'playing' && player.gameweekPoints === null,
        gwtotalPts: player.totalPoints,
        playerValue
      }
    }
  })
}
