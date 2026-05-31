/**
 * Thin wrapper around PostHog so the rest of the app never imports posthog-js directly.
 * All calls are no-ops when PostHog is unavailable (e.g. in tests).
 */
import posthog from 'posthog-js';

const TOKEN = 'phc_zTwjCNMorG8XaXpgHqhZNkufHT8tcAb3Z63NYfCp5pdY';
const API_HOST = 'https://us.i.posthog.com';

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  posthog.init(TOKEN, {
    api_host: API_HOST,
    // Capture clicks, form submissions, page-views automatically
    autocapture: true,
    capture_pageview: true,
    // Don't capture sensitive URL params (admin tokens etc.)
    sanitize_properties: (props) => {
      // Strip ?admin=... and ?p=... from $current_url
      if (props.$current_url) {
        try {
          const u = new URL(props.$current_url as string);
          u.searchParams.delete('admin');
          u.searchParams.delete('p');
          props.$current_url = u.toString();
        } catch { /* ignore */ }
      }
      return props;
    },
    persistence: 'localStorage',
    // Don't send events in dev unless explicitly forced
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing();
    },
  });
}

// ── Identity ────────────────────────────────────────────────────────────────

export function identifyUser(userId: string, email?: string) {
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetUser() {
  posthog.reset();
}

// ── Events ──────────────────────────────────────────────────────────────────

/** User started typing / submitted a new creation prompt */
export function trackCreationStarted(type: string, prompt: string) {
  posthog.capture('creation_started', { creation_type: type, prompt_length: prompt.length });
}

/** AI generation finished and creation is ready */
export function trackCreationCompleted(type: string, version: number) {
  posthog.capture('creation_completed', { creation_type: type, version });
}

/** User improved or added to an existing creation */
export function trackCreationImproved(mode: 'improve' | 'add') {
  posthog.capture('creation_improved', { mode });
}

/** User opened the share panel */
export function trackSharePanelOpened(creationType: string) {
  posthog.capture('share_panel_opened', { creation_type: creationType });
}

/** A share link was successfully created */
export function trackShareLinkCreated(creationType: string) {
  posthog.capture('share_link_created', { creation_type: creationType });
}

/** User on a shared page clicked "Make my own version" */
export function trackRemixClicked(creationType: string, shareSlug: string) {
  posthog.capture('remix_clicked', { creation_type: creationType, share_slug: shareSlug });
}

/** Someone loaded a shared tool page */
export function trackSharedPageViewed(creationType: string, accessMode: string) {
  posthog.capture('shared_page_viewed', { creation_type: creationType, access_mode: accessMode });
}

/** A participant submitted a pick / log on a shared page */
export function trackParticipantAction(action: string, creationType: string) {
  posthog.capture('participant_action', { action, creation_type: creationType });
}

/** User signed in or created an account */
export function trackSignIn(method: 'google' | 'magic_link' | 'password') {
  posthog.capture('sign_in', { method });
}

/** User signed out */
export function trackSignOut() {
  posthog.capture('sign_out');
}

/** User created a World Cup pool via the quick-create button */
export function trackWorldCupPoolCreated() {
  posthog.capture('world_cup_pool_created');
}

/** User deleted a creation */
export function trackCreationDeleted(creationType: string) {
  posthog.capture('creation_deleted', { creation_type: creationType });
}
