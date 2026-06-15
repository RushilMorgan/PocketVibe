import React, { useState } from 'react';
import { enablePush, isPushSupported, pushPermission } from '../lib/push';

const DISMISS_KEY = 'pv_push_nudge_dismissed';

interface PushNudgeProps {
  /** Attach the subscription to this signed-in user, if any. */
  userId?: string | null;
  /** Per-type accent for the enable button. */
  accentColor?: string;
}

/**
 * Opt-in nudge for Web Push, shown at a moment of delivered value (e.g. right
 * after a recipe extraction). Self-gating: renders nothing unless the browser
 * supports push, permission hasn't been decided, and the user hasn't dismissed
 * it before. Asking here — not on cold load — is the difference between a
 * granted prompt and a reflexive "Block".
 */
export function PushNudge({ userId, accentColor = '#7c3aed' }: PushNudgeProps) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'hidden'>(() => {
    if (!isPushSupported()) return 'hidden';
    if (pushPermission() !== 'default') return 'hidden';
    if (localStorage.getItem(DISMISS_KEY)) return 'hidden';
    return 'idle';
  });

  if (state === 'hidden') return null;

  if (state === 'done') {
    return (
      <div className="mt-4 flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5" data-testid="push-nudge-done">
        <span className="text-xl flex-shrink-0">🔔</span>
        <p className="text-sm font-bold tp-ink leading-tight">You're set — we'll ping you when your tools are ready.</p>
      </div>
    );
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setState('hidden');
  }

  async function enable() {
    setState('working');
    const ok = await enablePush(userId);
    if (ok) {
      setState('done');
    } else {
      // Permission denied or unsupported mid-flow — don't nag again.
      localStorage.setItem(DISMISS_KEY, '1');
      setState('hidden');
    }
  }

  return (
    <div className="mt-4 tp-card rounded-[20px] px-4 py-3.5" data-testid="push-nudge">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${accentColor}1a` }}>🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tp-ink leading-tight">Get a ping when it's ready</p>
          <p className="text-xs tp-ink-2 mt-0.5">We'll notify you the moment a long extraction finishes.</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={enable}
          disabled={state === 'working'}
          data-testid="push-nudge-enable"
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold active:scale-[0.99] transition-transform disabled:opacity-60"
          style={{ background: '#16150f' }}
        >
          {state === 'working' ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button
          onClick={dismiss}
          data-testid="push-nudge-dismiss"
          className="px-4 py-2.5 rounded-xl text-sm font-semibold tp-ink-3 active:bg-black/5"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
