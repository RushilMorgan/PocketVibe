/**
 * PocketVibe feature flags.
 *
 * DEV_MODE: exposes all template categories and dev tooling on the home screen.
 * Controlled by the VITE_DEV_MODE env var or the ?dev URL param at runtime.
 */
export const DEV_MODE: boolean = (() => {
  if (import.meta.env.VITE_DEV_MODE === 'true') return true;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).has('dev');
  }
  return false;
})();
