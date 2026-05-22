import { Phone, Scissors, ShowerHead, PawPrint } from 'lucide-react';
import type { SiteConfig, SiteBuilderAction, CanvasComponent } from '../../types';

interface LandingPageProps {
  siteConfig: SiteConfig;
  revealed: boolean;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export default function LandingPage({ siteConfig, revealed, dispatch }: LandingPageProps) {
  const { colors } = siteConfig;

  const tap = (component: CanvasComponent) => (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TAP_CANVAS_ELEMENT', payload: component });
  };

  // Helper: returns transition style for staggered reveal animation
  const reveal = (delayMs: number) => ({
    style: {
      transitionDelay: revealed ? `${delayMs}ms` : '0ms',
      fontFamily: colors.fontFamily,
    } as React.CSSProperties,
    className: `transition-all duration-700 ${
      revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
    }`,
  });

  return (
    <div
      className="min-h-full w-full"
      style={{
        backgroundColor: colors.canvasBg,
        transition: 'background-color 0.4s ease',
        fontFamily: colors.fontFamily,
      }}
      onClick={tap('background')}
    >
      {/* ── Navbar ── */}
      <div
        className={`flex items-center justify-between px-5 py-3 ${reveal(0).className}`}
        style={{ ...reveal(0).style, backgroundColor: colors.cardBg, transition: 'all 0.7s ease' }}
      >
        <div className="flex items-center gap-2">
          <PawPrint className="w-5 h-5" style={{ color: colors.accent }} />
          <span className="font-bold text-sm" style={{ color: colors.headline }}>
            {siteConfig.businessName}
          </span>
        </div>
        <button
          onClick={tap('cta')}
          className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95"
          style={{
            backgroundColor: colors.primaryBtn,
            color: colors.primaryBtnText,
            transition: 'background-color 0.4s ease',
          }}
        >
          Book Now
        </button>
      </div>

      {/* ── Hero ── */}
      <div
        className={`px-5 pt-5 pb-4 ${reveal(80).className}`}
        style={reveal(80).style}
        onClick={tap('headline')}
      >
        <div
          className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3"
          style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}
        >
          ⭐ Rated #1 Mobile Groomer
        </div>
        <h1
          className="text-[22px] font-extrabold leading-tight mb-2"
          style={{ color: colors.headline, transition: 'color 0.4s ease' }}
        >
          {siteConfig.headline}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: colors.body }}>
          {siteConfig.subheadline}
        </p>
      </div>

      {/* ── Dog image placeholder ── */}
      <div
        className={`mx-5 rounded-2xl overflow-hidden mb-4 ${reveal(160).className}`}
        style={{
          ...reveal(160).style,
          height: '150px',
          backgroundColor: `${colors.accent}25`,
          transition: 'all 0.7s ease',
        }}
        onClick={tap('image')}
      >
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 select-none">
          <span className="text-6xl">🐶</span>
          <span className="text-xs font-semibold" style={{ color: colors.body }}>
            Fresh &amp; Fluffy
          </span>
        </div>
      </div>

      {/* ── CTA button ── */}
      <div
        className={`px-5 mb-5 ${reveal(240).className}`}
        style={reveal(240).style}
        onClick={tap('cta')}
      >
        <button
          className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97]"
          style={{
            backgroundColor: colors.primaryBtn,
            color: colors.primaryBtnText,
            boxShadow: `0 6px 24px ${colors.primaryBtn}55`,
            transition: 'background-color 0.4s ease, box-shadow 0.4s ease',
          }}
        >
          {siteConfig.ctaText}
        </button>
      </div>

      {/* ── Services ── */}
      <div
        className={`px-5 mb-4 ${reveal(320).className}`}
        style={reveal(320).style}
        onClick={tap('service')}
      >
        <h2 className="text-base font-bold mb-3" style={{ color: colors.headline }}>
          Our Services
        </h2>
        <div className="flex flex-col gap-2">
          {([
            { icon: ShowerHead, label: 'Bath & Blow-Dry', price: 'from $45' },
            { icon: Scissors, label: 'Full Groom & Trim', price: 'from $65' },
            { icon: Phone, label: 'Mobile Pickup', price: 'FREE' },
          ] as const).map(({ icon: Icon, label, price }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                backgroundColor: colors.cardBg,
                transition: 'background-color 0.4s ease',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${colors.accent}22` }}
              >
                <Icon className="w-4 h-4" style={{ color: colors.accent }} />
              </div>
              <span
                className="text-sm font-medium flex-1"
                style={{ color: colors.headline }}
              >
                {label}
              </span>
              <span className="text-xs font-bold" style={{ color: colors.accent }}>
                {price}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className={`px-5 pb-8 text-center ${reveal(400).className}`}
        style={reveal(400).style}
      >
        <p className="text-xs" style={{ color: `${colors.body}90` }}>
          📍 Serving your neighborhood • 7 days a week
        </p>
      </div>
    </div>
  );
}
