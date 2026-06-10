/**
 * Tiny global celebration bus: any component can fire a confetti moment
 * without prop drilling. CelebrationLayer (mounted in App) listens and
 * renders the burst. Dispatching with no listener mounted is a no-op, so
 * renderers can celebrate safely wherever they're used.
 */

export const CELEBRATE_EVENT = 'pv-celebrate';

export interface CelebrationDetail {
  /** 'small' = quiet burst for everyday wins; 'big' = full confetti + message. */
  intensity?: 'small' | 'big';
  /** Optional toast shown with the burst (big moments only, usually). */
  message?: string;
}

export function celebrate(detail: CelebrationDetail = {}): void {
  try {
    window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail }));
  } catch {
    // Non-browser environment — celebrations are strictly optional
  }
}
