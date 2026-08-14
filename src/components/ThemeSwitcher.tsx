'use client';

import { useEffect, useState } from 'react';

const THEMES = ['prussian', 'aquamarine'] as const;
type Theme = (typeof THEMES)[number];

export default function ThemeSwitcher({
  defaultTheme = 'aquamarine',
}: {
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  // Apply the saved theme on first load (falls back to the app default).
  useEffect(() => {
    const saved = (localStorage.getItem('dt-theme') as Theme) || defaultTheme;
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, [defaultTheme]);

  const cycle = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('dt-theme', next);
  };

  return (
    <button
      onClick={cycle}
      aria-label={`Colour theme: ${theme}. Click to change.`}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-dt-border bg-dt-surface px-3 py-2 text-xs text-dt-content shadow-lg transition hover:bg-dt-surface-2"
    >
      Theme: {theme}
    </button>
  );
}
