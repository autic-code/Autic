/**
 * Minimal blue-themed design tokens for the Autic CLI.
 */

export const theme = {
  colors: {
    primary: '#4A9EFF',
    primaryDim: '#2563EB',
    primaryDark: '#1E40AF',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    text: '#E2E8F0',
    textDim: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0F172A',

    surface: '#1E293B',
    surfaceAlt: '#1A2332',
    surfaceRaised: '#2D3B4F',
    border: '#334155',
    borderLight: '#475569',

    bg: '#0F172A',
    bgAlt: '#131C2C',
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 6,
  },

  border: {
    radius: 1,
    style: 'round' as const,
  },

  icon: {
    arrow: '❯',
    check: '✓',
    cross: '✗',
    dot: '•',
    ellipsis: '…',
    bullet: '●',
    divider: '─',
    shield: '🛡',
    lock: '🔒',
    warning: '⚠',
  },
} as const;

export type Theme = typeof theme;
