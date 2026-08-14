import { NextResponse } from 'next/server';
import { getClubFromFlag, isJwtExpired } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
//  AUTHORITATIVE PLAYER-RETRIEVAL ROUTE — DO NOT CHANGE THE API CONTRACT WITHOUT
//  FOLLOWING THE CHANGE-CONTROL PROCESS IN:  docs/API-CONTRACT-player-retrieval.md
//  (repo root). That document is the single source of truth for how player data
//  is fetched. Editing endpoint, params, or the normalise() mapping without the
//  sign-off + test steps there is a breaking change that can silently corrupt
//  the pool (e.g. £0 prices, Unknown clubs). Read it first.
// ─────────────────────────────────────────────────────────────────────────────
//
// 2026/27 season: the old unauthenticated players.json feed is gone. This route
// calls the authenticated backend API in TWO steps — resolve the active
// tournamentCalendarId, then fetch the full pool from /players in ONE call
// (data.items, no pagination) — and normalises each player into the shape the
// app expects (id, displayName, position, playerClub, price, gameweekPoints,
// totalPoints, status).
//
// Auth: the caller supplies a Bearer token (from the capture UI) via the
// Authorization header. The token is a ~24h JWT. NOTE: the token's `sub` claim
// is NOT the /players `userId` — that is a separate account UUID sourced from
// the DREAMTEAM_USER_ID env var. The token is NEVER logged.

const API_BASE =
  'https://engagecraft-fantasy-backend-prod.azurewebsites.net/api';

interface ApiPlayer {
  playerId?: string; // /players/stats shape
  id?: string;       // /players shape (unpaginated) — this is what we use
  optaPersonId?: string; // stable cross-season join key
  firstName?: string;
  lastName?: string;
  displayName: string;
  position: string;
  contestantFlagKey?: string;
  contestantShortName?: string;
  price?: number;
  gameweekPoints?: number | null;
  totalPoints?: number;
  averagePoints?: number;
  last3Average?: number;
  bonusPoints?: number;
  percentSelected?: number;
  availabilityDisplay?: string;
  injuryDetails?: unknown | null;
  suspensionDetails?: unknown | null;
}

// Derive the app's status string from the new API's fields.
function deriveStatus(p: ApiPlayer): string {
  if (p.injuryDetails) return 'injured';
  if (p.suspensionDetails) return 'suspended';
  if (p.availabilityDisplay && p.availabilityDisplay !== 'available') {
    return p.availabilityDisplay; // e.g. 'unavailable', 'eliminated'
  }
  return 'playing';
}

function normalise(p: ApiPlayer) {
  return {
    id: p.id ?? p.playerId, // UUID string this season (/players uses `id`)
    optaPersonId: p.optaPersonId ?? '', // stable cross-season join key
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    displayName: p.displayName,
    position: p.position, // GK / DEF / MID / STR
    playerClub: getClubFromFlag(p.contestantFlagKey),
    contestantFlagKey: p.contestantFlagKey ?? '',
    price: p.price ?? 0, // already un-scaled (e.g. 2.5) — no /1_000_000
    gameweekPoints: p.gameweekPoints ?? null,
    totalPoints: p.totalPoints ?? 0,
    averagePoints: p.averagePoints ?? 0,
    percentSelected: p.percentSelected ?? 0,
    status: deriveStatus(p),
  };
}

export async function GET(request: Request) {
  // 1. Token from the Authorization header (or x-dtfc-token fallback).
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('x-dtfc-token') ||
    '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return NextResponse.json(
      { message: 'Missing token. Paste a fresh Bearer token and try again.' },
      { status: 401 }
    );
  }
  if (isJwtExpired(token)) {
    return NextResponse.json(
      { message: 'Token has expired. Log in again and paste a fresh token.' },
      { status: 401 }
    );
  }

  // The /players endpoint requires the account UUID as `userId`. This is NOT the
  // token's `sub` claim (that's a different, unrelated id). It's stable across
  // logins, so it lives in DREAMTEAM_USER_ID (server-only env).
  const userId = process.env.DREAMTEAM_USER_ID?.trim() || '';

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    accept: 'application/json',
  };

  try {
    // 2. Current tournament calendar id (drives everything, changes each season).
    const tcRes = await fetch(`${API_BASE}/tournament-calendars/active`, {
      headers: authHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(25000), // fail fast instead of hanging
    });
    if (tcRes.status === 401) {
      return NextResponse.json(
        { message: 'Token rejected (401). Paste a fresh token.' },
        { status: 401 }
      );
    }
    if (!tcRes.ok) {
      throw new Error(`tournament-calendars/active failed: ${tcRes.status}`);
    }
    const tcJson = await tcRes.json();
    const tournamentCalendarId =
      tcJson?.data?.tournamentCalendarId ||
      tcJson?.data?.id ||
      tcJson?.tournamentCalendarId;
    if (!tournamentCalendarId) {
      throw new Error('Could not read tournamentCalendarId from response');
    }

    // 3. Fetch the full player pool in ONE call.
    // The player feed is /players (NOT /players/stats). It returns every player
    // in data.items with un-scaled prices (e.g. 2.5) and upcoming fixtures — no
    // pagination. /players/stats is a different, gameweek-stats endpoint that
    // rejects this request pre-season; /players is the correct pool source.
    const params = new URLSearchParams({
      tournamentCalendarId,
      type: 'gameweek',
      limit_fixture: '3',
    });
    if (userId) params.set('userId', userId);

    const res = await fetch(`${API_BASE}/players?${params}`, {
      headers: authHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(25000), // fail fast instead of hanging
    });
    if (res.status === 401) {
      return NextResponse.json(
        { message: 'Token rejected mid-fetch (401). Paste a fresh token.' },
        { status: 401 }
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `players fetch failed: ${res.status}${body ? ` — ${body.slice(0, 300)}` : ''}`
      );
    }

    const json = await res.json();
    const items: ApiPlayer[] = json?.data?.items ?? [];
    if (items.length === 0) {
      throw new Error(
        'players fetch returned 0 items — unexpected response shape or empty pool.'
      );
    }
    const all = items.map(normalise);

    return NextResponse.json(all);
  } catch (error) {
    // Note: never include the token in logs.
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const message = isTimeout
      ? 'The player API did not respond in time (timeout). Try again.'
      : error instanceof Error
      ? error.message
      : 'Unknown error fetching players';
    console.error('[api/players] fetch failed:', message);
    return NextResponse.json(
      { message: 'Error fetching player data', error: message },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
