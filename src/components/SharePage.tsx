import React, { useEffect, useMemo, useState } from 'react';
import AppShell from './AppShell';
import { routeShare, type ShareSuggestion, type ShareTarget } from '../lib/shareRouter';

/**
 * The Web Share Target landing (`/share`).
 *
 * Reached two ways:
 *   1. Android — the installed PWA is picked from the OS share sheet; the
 *      manifest's `share_target` GETs here with ?title&text&url.
 *   2. iOS (best-effort) — an iOS Shortcut (or any deep link) opens
 *      /share?url=…  since Safari has no reliable Web Share Target. When the
 *      payload is empty we offer a clipboard paste so the flow still works.
 *
 * Smart routing (Option 3): we infer the best tool from the URL and pre-select
 * it, but show every option so the user can override before confirming. Picking
 * a tool navigates to that tool page with the link in ?shared=, where it
 * auto-runs.
 */
export function SharePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initial = useMemo<ShareSuggestion>(
    () =>
      routeShare({
        url: params.get('url'),
        text: params.get('text'),
        title: params.get('title'),
      }),
    [params],
  );

  // When nothing arrived (common on iOS), let the user paste a link.
  const [pasted, setPasted] = useState('');
  const suggestion = useMemo<ShareSuggestion>(() => {
    if (initial.url || initial.text) return initial;
    if (pasted.trim()) return routeShare({ text: pasted.trim() });
    return initial;
  }, [initial, pasted]);

  const hasPayload = Boolean(suggestion.url || suggestion.text);

  // Best-effort: on iOS the share sheet may not pass anything — try the
  // clipboard so a copied link can still flow through without manual paste.
  useEffect(() => {
    if (hasPayload) return;
    let cancelled = false;
    (async () => {
      try {
        const clip = await navigator.clipboard?.readText?.();
        if (!cancelled && clip && /https?:\/\//i.test(clip)) setPasted(clip);
      } catch {
        // Permission denied / unsupported — the manual paste box covers it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasPayload]);

  function go(target: ShareTarget) {
    const payload = suggestion.url || suggestion.text;
    const q = payload ? `?shared=${encodeURIComponent(payload)}` : '';
    if (target.key === 'home') {
      window.location.href = payload ? `/${q}` : '/';
    } else {
      window.location.href = `/tools/${target.key}${q}`;
    }
  }

  const top = suggestion.targets[0];
  const rest = suggestion.targets.slice(1);

  return (
    <AppShell>
      <div className="tp-surface flex flex-col h-full overflow-y-auto" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <header className="flex-shrink-0 px-5 pt-5 pb-2">
          <a href="/" className="text-[13px] font-semibold tp-ink-3 active:opacity-70">← Hey Toolie</a>
        </header>

        <div className="px-5 pt-3 pb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--tp-accent, #7c3aed)' }}>
            Shared with Toolie
          </span>
          <h1 className="text-xl font-extrabold tp-ink tracking-tight mt-1 mb-1">
            What should Toolie do with this?
          </h1>

          {/* The shared link / text preview */}
          {hasPayload ? (
            <div className="tp-card rounded-2xl px-4 py-3 mt-3 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-wide tp-ink-3 mb-1">You shared</p>
              <p className="text-sm tp-ink break-words line-clamp-3">{suggestion.url ?? suggestion.text}</p>
            </div>
          ) : (
            <div className="tp-card rounded-2xl px-4 py-4 mt-3 mb-5">
              <p className="text-sm tp-ink-2 mb-2">Paste a link to get started:</p>
              <input
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                inputMode="url"
                placeholder="https://…"
                className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm tp-ink bg-white/70 outline-none focus:border-black/30"
                data-testid="share-paste-input"
              />
            </div>
          )}

          {hasPayload && (
            <div className="flex flex-col gap-2.5">
              {/* Pre-selected best guess — visually primary */}
              <button
                onClick={() => go(top)}
                data-testid={`share-target-${top.key}`}
                className="flex items-center gap-3 w-full text-left rounded-2xl px-4 py-3.5 bg-[#16150f] text-white active:scale-[0.99] transition-transform"
              >
                <span className="text-2xl flex-shrink-0">{top.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold">{top.label}</span>
                  <span className="block text-xs text-white/60">{top.blurb}</span>
                </span>
                <span className="text-xs font-semibold text-white/50 flex-shrink-0">Suggested →</span>
              </button>

              {rest.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wide tp-ink-3 mt-2 px-1">Or use a different tool</p>
              )}
              {rest.map(target => (
                <button
                  key={target.key}
                  onClick={() => go(target)}
                  data-testid={`share-target-${target.key}`}
                  className="flex items-center gap-3 w-full text-left tp-card rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
                >
                  <span className="text-xl flex-shrink-0">{target.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold tp-ink">{target.label}</span>
                    <span className="block text-xs tp-ink-3">{target.blurb}</span>
                  </span>
                  <span className="text-sm flex-shrink-0 tp-ink-3">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
