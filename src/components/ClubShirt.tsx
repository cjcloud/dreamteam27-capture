'use client';

import { useState } from 'react';

// Map the app's club codes -> the shirt-image file key (matches the files in
// /shirts). Outfield shirt = /shirts/{KEY}.webp, goalkeeper = /shirts/{KEY}_GK.webp.
const SHIRT_BY_CLUB: Record<string, string> = {
  ARS: 'ARS',
  VILLA: 'AVI',
  BRI: 'BRI',
  BOU: 'BOU',
  BRE: 'BRE',
  CHE: 'CHE',
  COV: 'COV',
  PAL: 'PAL',
  EVE: 'EVE',
  FUL: 'FUL',
  HUL: 'HUL',
  IPS: 'IPS',
  LEE: 'LEE',
  LIV: 'LIV',
  'MAN C': 'MCI',
  'MAN U': 'MUN',
  NEW: 'NEW',
  FOR: 'NFO',
  SUN: 'SUN',
  SPURS: 'TOT',
};

const KNOWN_KEYS = new Set(Object.values(SHIRT_BY_CLUB));

// Resolve a club value (app code, or already a shirt key) to a shirt key.
export function shirtKeyFor(club?: string): string | null {
  if (!club) return null;
  const c = club.trim();
  if (SHIRT_BY_CLUB[c]) return SHIRT_BY_CLUB[c];
  const up = c.toUpperCase();
  if (KNOWN_KEYS.has(up)) return up;
  return null;
}

export default function ClubShirt({
  club,
  position,
  size = 22,
  className = '',
}: {
  club?: string;
  position?: string;
  size?: number;
  className?: string;
}) {
  const key = shirtKeyFor(club);
  const isGK = (position || '').toUpperCase() === 'GK';
  const [errored, setErrored] = useState(false);

  // Fallback: a small initials chip when there's no shirt file / unknown club.
  if (!key || errored) {
    return (
      <span
        title={club || 'Unknown'}
        aria-label={club || 'Unknown club'}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: 4,
          fontSize: Math.max(8, Math.round(size * 0.36)),
          lineHeight: 1,
          fontWeight: 500,
          background: 'var(--dt-surface-2)',
          color: 'var(--dt-content)',
        }}
      >
        {(club || '?').replace(/\s/g, '').slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`/shirts/${key}${isGK ? '_GK' : ''}.webp`}
      alt={club ? `${club}${isGK ? ' goalkeeper' : ''} shirt` : 'club shirt'}
      title={club}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block' }}
    />
  );
}
