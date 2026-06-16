import { Fragment, useEffect, useState } from 'react';
import { CELEBRATE_EVENT, type CelebrationDetail } from '../lib/celebrate';

interface Particle {
  id: number;
  left: number;       // % across the shell
  size: number;       // px
  color: string;
  drift: number;      // px of horizontal drift while falling
  rotate: number;     // total degrees of spin
  duration: number;   // s
  delay: number;      // s
  round: boolean;
}

interface Burst {
  id: number;
  detail: CelebrationDetail;
  particles: Particle[];
}

const COLORS = ['#7c3aed', '#f59e0b', '#10b981', '#38bdf8', '#f43f5e', '#facc15', '#fb7185'];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 6 + Math.random() * 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    drift: (Math.random() - 0.5) * 140,
    rotate: 360 + Math.random() * 540,
    duration: 1.3 + Math.random() * 0.9,
    delay: Math.random() * 0.3,
    round: Math.random() < 0.4,
  }));
}

/**
 * Renders confetti bursts fired through celebrate(). Mounted once inside the
 * app shell; sits above sheets/modals and never intercepts taps. Honors
 * prefers-reduced-motion by showing only the message toast.
 */
export function CelebrationLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    function onCelebrate(e: Event) {
      const detail = ((e as CustomEvent).detail ?? {}) as CelebrationDetail;
      const reducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion && !detail.message) return;

      const id = Date.now() + Math.random();
      const count = detail.intensity === 'big' ? 60 : 26;
      setBursts(prev => [
        ...prev,
        { id, detail, particles: reducedMotion ? [] : makeParticles(count) },
      ]);
      window.setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, 2600);
    }
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div
      data-testid="celebration-layer"
      className="absolute inset-0 z-[80] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {bursts.map(burst => (
        <Fragment key={burst.id}>
          {burst.particles.map(p => (
            <span
              key={`${burst.id}-${p.id}`}
              className="confetti-piece"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: p.round ? '50%' : '2px',
                '--cf-drift': `${p.drift}px`,
                '--cf-rotate': `${p.rotate}deg`,
                '--cf-duration': `${p.duration}s`,
                '--cf-delay': `${p.delay}s`,
              } as React.CSSProperties}
            />
          ))}
          {burst.detail.message && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 animate-fade-in">
              <div className="px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg whitespace-nowrap" style={{ background: '#16150f' }}>
                {burst.detail.message}
              </div>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
