import React, { useEffect, useState } from 'react';
import AppShell from './AppShell';
import { CelebrationLayer } from './CelebrationLayer';
import { RecipeExtractorTool } from './tools/RecipeExtractorTool';
import { SectionLabel, AccentEyebrow, HeroTile, ToolCard, ToolButton } from './tools/ui';
import { getToolPageConfig, type ToolPageConfig, type ToolChip, type ToolAccent } from '../lib/toolPages';
import { getTemplateIdentity } from '../lib/templateIdentity';

interface ToolPageProps {
  /** URL key — the slug after /tools/. */
  toolKey: string;
}

/** Live, interactive body for each tool, looked up by config key. */
const LIVE_TOOLS: Record<string, React.ComponentType<{ chips: ToolChip[]; accent: ToolAccent }>> = {
  'recipe-extractor': RecipeExtractorTool,
};

/**
 * Standalone tool-page shell — "Velix" light/frosted look (see the .tp-* layer
 * in index.css and the primitives in tools/ui.tsx). Reads a per-tool config from
 * toolPages.ts and renders: hero → how-it-works → live tool → customize →
 * where-to-go-next → footer. Primary actions are near-black; the per-type colour
 * is the soft accent.
 */
export function ToolPage({ toolKey }: ToolPageProps) {
  const config = getToolPageConfig(toolKey);
  const LiveTool = config ? LIVE_TOOLS[config.key] : undefined;

  useEffect(() => {
    if (!config || !LiveTool) window.location.replace('/');
  }, [config, LiveTool]);

  if (!config || !LiveTool) return null;

  const identity = getTemplateIdentity(config.identityKey);
  const accent: ToolAccent = { accent: identity.accent, accentSoft: identity.accentSoft };

  return (
    <AppShell>
      <CelebrationLayer />

      <div className="tp-surface flex flex-col h-full overflow-hidden">
        <header className="flex-shrink-0 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a
              href="/"
              aria-label="Back to Hey Toolie"
              className="w-9 h-9 rounded-2xl tp-glass flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16150f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            <span className="text-sm font-bold tp-ink tracking-tight flex items-center gap-1.5">
              <span style={{ color: accent.accent }}>✦</span> Hey Toolie
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Hero config={config} accent={accent} emoji={identity.emoji} />
          <HowItWorks config={config} accent={accent} />
          <LiveTool chips={config.chips} accent={accent} />
          <Customize config={config} accent={accent} />
          <WhereNext config={config} accent={accent} />
          <Footer canonicalPath={config.canonicalPath} title={config.h1} />
        </div>
      </div>
    </AppShell>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function Hero({ config, accent, emoji }: { config: ToolPageConfig; accent: ToolAccent; emoji: string }) {
  return (
    <div className="px-5 pt-4 pb-2">
      <div className="mb-4"><HeroTile accent={accent} emoji={emoji} /></div>
      <AccentEyebrow accent={accent}>{config.eyebrow}</AccentEyebrow>
      <h1 className="tp-ink text-[34px] font-extrabold tracking-tight leading-[1.04] mt-1.5">{config.h1}</h1>
      <p className="tp-ink-2 text-[15px] mt-2.5 leading-relaxed max-w-xs">{config.tagline}</p>
      <p className="tp-ink-3 text-xs mt-3 leading-relaxed max-w-sm">{config.intro}</p>

      <div className="flex items-center gap-2.5 mt-5">
        <ToolButton href="#try-it" testId="hero-try-cta">Try it now <span>→</span></ToolButton>
        <ToolButton href="#how-it-works" variant="ghost">How it works</ToolButton>
      </div>
    </div>
  );
}

function HowItWorks({ config, accent }: { config: ToolPageConfig; accent: ToolAccent }) {
  return (
    <div id="how-it-works" className="px-5 py-6 scroll-mt-4">
      <SectionLabel>How it works</SectionLabel>
      <div className="flex flex-col gap-3.5">
        {config.steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3.5">
            <div
              className="relative w-12 h-12 rounded-[16px] tp-glass flex items-center justify-center text-xl flex-shrink-0"
              style={{ boxShadow: `0 8px 20px ${accent.accent}2e` }}
            >
              {s.icon}
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full tp-btn-dark text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <div className="pt-0.5">
              <p className="text-[15px] font-bold tp-ink">{s.title}</p>
              <p className="text-[13px] tp-ink-2 mt-0.5 leading-snug">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customize({ config, accent }: { config: ToolPageConfig; accent: ToolAccent }) {
  return (
    <div className="px-5 py-6">
      <AccentEyebrow accent={accent}>Make it yours</AccentEyebrow>
      <h2 className="text-lg font-extrabold tp-ink tracking-tight mt-1 mb-2">Customize with Hey Toolie</h2>
      <p className="text-sm tp-ink-2 leading-relaxed">{config.customizeIntro}</p>

      <ToolCard className="mt-4">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🎙️</span>
          <p className="text-xs tp-ink-2 leading-relaxed">
            Prefer talking? Open <span className="font-semibold tp-ink">Ask Toolie</span> on your recipe and tap the mic —
            say "make step three simpler" and it just does it. Or tap any line to edit it by hand.
          </p>
        </div>
      </ToolCard>
    </div>
  );
}

function WhereNext({ config, accent }: { config: ToolPageConfig; accent: ToolAccent }) {
  return (
    <div className="px-5 py-6">
      <SectionLabel>Where to go next</SectionLabel>
      <div className="flex flex-col gap-3">
        {config.whereNext.map((w, i) => (
          <a key={i} href={w.href} className="flex items-center gap-3.5 tp-card rounded-[22px] p-4 active:scale-[0.99] transition-transform">
            <HeroTile accent={accent} emoji={w.icon} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold tp-ink">{w.title}</p>
              <p className="text-[13px] tp-ink-2 mt-0.5 leading-snug">{w.body}</p>
            </div>
            <span className="text-xs font-bold flex-shrink-0" style={{ color: accent.accent }}>{w.cta} →</span>
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
    <footer className="px-5 pt-4 pb-9">
      <ToolButton shape="block" full onClick={share} testId="tool-share-btn" className="font-bold mb-4">
        {copied ? '✓ Link copied' : '🔗 Share this tool'}
      </ToolButton>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[#16150f]/40 text-xs">✦</span>
          <p className="text-xs tp-ink-3 font-medium">Made with Hey Toolie</p>
        </div>
        <div className="flex items-center gap-3 text-xs tp-ink-3">
          <a href="/privacy" className="active:opacity-60">Privacy</a>
          <a href="/terms" className="active:opacity-60">Terms</a>
        </div>
      </div>
    </footer>
  );
}
