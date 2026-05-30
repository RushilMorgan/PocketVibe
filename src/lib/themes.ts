import type { ColourTheme } from '../types';

export interface ThemeDef {
  id: ColourTheme;
  label: string;
  fromHex: string;
  toHex: string;
  gradient: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'classic',      label: 'Classic', fromHex: '#f59e0b', toHex: '#f97316', gradient: 'from-yellow-500 to-orange-500' },
  { id: 'bold',         label: 'Bold',    fromHex: '#7c3aed', toHex: '#4338ca', gradient: 'from-violet-600 to-indigo-700' },
  { id: 'fun',          label: 'Fun',     fromHex: '#ec4899', toHex: '#f43f5e', gradient: 'from-pink-500 to-rose-400' },
  { id: 'dark',         label: 'Dark',    fromHex: '#1f2937', toHex: '#111827', gradient: 'from-gray-800 to-gray-900' },
  { id: 'team-colours', label: 'Team',    fromHex: '#16a34a', toHex: '#0f766e', gradient: 'from-green-600 to-teal-700' },
];

export function getPoolGradient(theme: ColourTheme | undefined): string {
  if (!theme || theme === 'classic') return 'from-yellow-500 to-orange-500';
  return THEMES.find(t => t.id === theme)?.gradient ?? 'from-yellow-500 to-orange-500';
}

/** Returns the primary accent hex for use in inline styles throughout the tool. */
export function getThemeAccent(theme: ColourTheme | undefined): string {
  if (!theme) return '#f59e0b';
  return THEMES.find(t => t.id === theme)?.fromHex ?? '#f59e0b';
}

export function getWorkoutGradient(theme: ColourTheme | undefined): string {
  if (!theme || theme === 'classic') return 'from-red-500 to-orange-500';
  return THEMES.find(t => t.id === theme)?.gradient ?? 'from-red-500 to-orange-500';
}
