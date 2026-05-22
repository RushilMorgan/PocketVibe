import type { ThemeName, ThemeColors } from '../types';

export const themes: Record<ThemeName, ThemeColors> = {
  default: {
    canvasBg: '#f8f7ff',
    cardBg: '#ffffff',
    primaryBtn: '#7c3aed',
    primaryBtnText: '#ffffff',
    headline: '#1a1a2e',
    body: '#4a4a6a',
    accent: '#7c3aed',
    fontFamily: 'inherit',
  },
  'soft-pink': {
    canvasBg: '#fff0f3',
    cardBg: '#ffe4e8',
    primaryBtn: '#f43f5e',
    primaryBtnText: '#ffffff',
    headline: '#881337',
    body: '#9f1239',
    accent: '#f43f5e',
    fontFamily: 'inherit',
  },
  'sage-green': {
    canvasBg: '#f0fdf4',
    cardBg: '#dcfce7',
    primaryBtn: '#16a34a',
    primaryBtnText: '#ffffff',
    headline: '#14532d',
    body: '#166534',
    accent: '#16a34a',
    fontFamily: 'inherit',
  },
  'ocean-blue': {
    canvasBg: '#eff6ff',
    cardBg: '#dbeafe',
    primaryBtn: '#1e3a5f',
    primaryBtnText: '#ffffff',
    headline: '#1e3a5f',
    body: '#1d4ed8',
    accent: '#3b82f6',
    fontFamily: "'Nunito', sans-serif",
  },
};
