import React, { useEffect, useState } from 'react';
import AppShell from './AppShell';
import { CelebrationLayer } from './CelebrationLayer';
import { RecipeExtractorTool } from './tools/RecipeExtractorTool';
import { getToolPageConfig, type ToolPageConfig, type ToolChip } from '../lib/toolPages';
import { getTemplateIdentity } from '../lib/templateIdentity';

interface ToolPageProps {
  /** URL key — the slug after /tools/. */
  toolKey: string;
}

/** Live, interactive body for each tool, looked up by config key. */
const LIVE_TOOLS: Record<string, React.ComponentType<{ chips: ToolChip[] }>> = {
  'recipe-extractor': RecipeExtractorTool,
};

/**
 * Generic standalone tool-page shell. Reads a per-tool config from toolPages.ts
 * and renders: hero → how-it-works → live tool → where-to-go-next → footer.
 * The recipe extractor is the first instance; future tools add a config entry
 * plus a LIVE_TOOLS component.
 */
export function ToolPage({ toolKey }: ToolPageProps) {
  const config = getToolPageConfig(toolKey);
  const LiveTool = config ? LIVE_TOOLS[config.key] : undefined;

  // Unknown tool key (or no live component yet) → send them to the app.
  useEffect(() => {
    if (!config || !LiveTool) {
      window.location.replace('/');
    }
  }, [config, LiveTool]);

  if (!config || !LiveTool) return null;

  const identity = getTemplateIdentity(config.identityKey);

  return (
    <AppShell>
      <CelebrationLayer />

      {/* Header — brand + back to app */}
      <header className="flex-shrink-0 bg-gray-900 px-4 py-3 flex items-center gap-2">
        <a
          href="/"
          aria-label="Back to Hey Toolie"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 active:bg-white/20 flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </a>
        <div className="flex items-center gap-1.5">
          <span className="text-violet-400 text-xs">✦</span>
          <span className="text-xs font-black text-white/60 tracking-tight">Hey Toolie</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Hero config={config} gradFrom={identity.gradFrom} gradTo={identity.gradTo} emoji={identity.emoji} />
        <HowItWorks config={config} />
        <LiveTool chips={config.chips} />
        <Customize config={config} />
        <WhereNext config={config} />
        <Footer canonicalPath={config.canonicalPath} title={config.h1} />
      </div>
    </AppShell>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function Hero({ config, gradFrom, gradTo, emoji }: { config: ToolPageConfig; gradFrom: string; gradTo: string; emoji: string }) {
  return (
    <div
      className="relative overflow-hidden px-5 pt-8 pb-7 text-white"
      style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
    >
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute right-10 bottom-2 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />

      <div className="relative z-10">
        <span className="text-5xl leading-none">{emoji}</span>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">{config.eyebrow}</p>
        <h1 className="text-3xl font-black leading-tight tracking-tight mt-1">{config.h1}</h1>
        <p className="text-sm text-white/85 mt-2 leading-relaxed max-w-xs">{config.tagline}</p>
        <p className="text-xs text-white/70 mt-3 leading-relaxed max-w-sm">{config.intro}</p>

        <div className="flex items-center gap-2 mt-5">
          <a
            href="#try-it"
            data-testid="hero-try-cta"
            className="text-sm font-black text-gray-900 bg-white px-5 py-2.5 rounded-full active:bg-white/90"
          >
            Try it now
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-semibold text-white/90 bg-white/15 px-5 py-2.5 rounded-full active:bg-white/25"
          >
            How it works
          </a>
        </div>
      </div>
    </div>
  );
}

function HowItWorks({ config }: { config: ToolPageConfig }) {
  return (
    <div id="how-it-works" className="px-5 py-6 scroll-mt-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-100" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">How it works</p>
        <div className="h-px flex-1 bg-gray-100" />
      </div>
      <div className="flex flex-col gap-3.5">
        {config.steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3.5">
            <div className="relative w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-base flex-shrink-0 shadow-sm shadow-rose-200">
              {s.icon}
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-gray-800">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customize({ config }: { config: ToolPageConfig }) {
  return (
    <div className="px-5 py-6 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">Make it yours</span>
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-2">Customize with Hey Toolie</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{config.customizeIntro}</p>

      <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100">
        <span className="text-xl flex-shrink-0">🎙️</span>
        <p className="text-xs text-gray-500 leading-relaxed">
          Prefer talking? Open <span className="font-semibold text-gray-700">Ask Toolie</span> on your recipe and tap the mic —
          say "make step three simpler" and it just does it. Or tap any line to edit it by hand.
        </p>
      </div>
    </div>
  );
}

function WhereNext({ config }: { config: ToolPageConfig }) {
  return (
    <div className="px-5 py-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-100" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Where to go next</p>
        <div className="h-px flex-1 bg-gray-100" />
      </div>
      <div className="flex flex-col gap-3">
        {config.whereNext.map((w, i) => (
          <a
            key={i}
            href={w.href}
            className="flex items-center gap-3.5 p-4 rounded-2xl border border-gray-100 bg-white active:bg-gray-50"
          >
            <span className="text-2xl flex-shrink-0">{w.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">{w.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{w.body}</p>
            </div>
            <span className="text-xs font-bold text-rose-600 flex-shrink-0">{w.cta} →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Footer({ canonicalPath, title }: { canonicalPath: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${canonicalPath}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${title} — Hey Toolie`, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled / clipboard blocked — nothing to do
    }
  }

  return (
    <footer className="px-5 py-8 bg-gray-900 mt-2">
      <button
        data-testid="tool-share-btn"
        onClick={share}
        className="w-full py-3 rounded-2xl bg-rose-500 text-white text-sm font-black active:bg-rose-600 mb-4"
      >
        {copied ? '✓ Link copied' : '🔗 Share this tool'}
      </button>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-violet-400 text-xs">✦</span>
          <p className="text-xs text-white/50 font-medium">Made with Hey Toolie</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <a href="/privacy" className="active:text-white/70">Privacy</a>
          <a href="/terms" className="active:text-white/70">Terms</a>
        </div>
      </div>
    </footer>
  );
}
