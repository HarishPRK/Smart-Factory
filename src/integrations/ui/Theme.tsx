import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = 'ce-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => initialTheme ?? readInitialTheme(),
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    // View Transitions API: HW-composited crossfade between snapshots.
    // flushSync ensures the DOM update lands synchronously inside the callback
    // so the browser captures correct before/after snapshots.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => {
        flushSync(() => setTheme(next));
      });
    } else {
      setTheme(next);
    }
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Hex/rgba values that need to be passed as JS strings (Recharts, SVG attributes). */
export interface ThemeColors {
  accent: string;
  accent2: string;
  accent3: string;
  ok: string;
  warn: string;
  err: string;
  text: string;
  textDim: string;
  textMuted: string;
  chartGrid: string;
  chartCursor: string;
  tooltipBg: string;
  tooltipBorder: string;
  panelSolid: string;
  surfaceDim: string;
  /** Color used for inactive map states / dim SVG fills */
  surfaceFaint: string;
  pinDot: string;
  pinHalo: string;
}

export const colorsByTheme: Record<Theme, ThemeColors> = {
  light: {
    accent:        '#087f99',
    accent2:       '#1873a2',
    accent3:       '#6956a1',
    ok:            '#287548',
    warn:          '#95641c',
    err:           '#b8443b',
    text:          '#173f4e',
    textDim:       '#346477',
    textMuted:     '#476f7d',
    chartGrid:     'rgba(52,100,119,0.14)',
    chartCursor:   'rgba(8,127,153,0.12)',
    tooltipBg:     '#ffffff',
    tooltipBorder: '#bedde6',
    panelSolid:    '#ffffff',
    surfaceDim:    '#edf8fb',
    surfaceFaint:  'rgba(8,127,153,0.07)',
    pinDot:        '#173f4e',
    pinHalo:       '#ffffff',
  },
  dark: {
    accent:        '#43d8f1',
    accent2:       '#65aeeb',
    accent3:       '#4ac2be',
    ok:            '#6ed6a2',
    warn:          '#e9bd70',
    err:           '#f18b82',
    text:          '#eef5f7',
    textDim:       '#bacbd4',
    textMuted:     '#a7bbc6',
    chartGrid:     'rgba(167,187,198,0.14)',
    chartCursor:   'rgba(67,216,241,0.12)',
    tooltipBg:     '#17232d',
    tooltipBorder: '#497080',
    panelSolid:    '#17232d',
    surfaceDim:    '#1d2d38',
    surfaceFaint:  'rgba(167,187,198,0.06)',
    pinDot:        '#0d151c',
    pinHalo:       '#17232d',
  },
};

export function useThemeColors(): ThemeColors {
  const { theme } = useTheme();
  return colorsByTheme[theme];
}
