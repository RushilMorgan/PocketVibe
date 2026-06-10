import type { Creation } from '../types';
import { getTemplateIdentity } from '../lib/templateIdentity';

interface CreationHeroProps {
  creation: Creation;
}

/**
 * Gradient identity header shown above plain template renderers — gives each
 * creation type its own colour story so finished tools feel made, not generic.
 * Templates with their own hero treatment opt out via identity.showHero.
 */
export function CreationHero({ creation }: CreationHeroProps) {
  const identity = getTemplateIdentity(creation.creationType);
  if (!identity.showHero) return null;

  return (
    <div
      data-testid="creation-hero"
      className="tpl-grad mx-4 mt-3 rounded-2xl p-4 text-white shadow-md overflow-hidden relative"
    >
      {/* Soft glow accent in the corner */}
      <div
        aria-hidden="true"
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/15"
      />
      <div className="relative flex items-center gap-3">
        <span
          className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0"
          aria-hidden="true"
        >
          {identity.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
            {identity.label}
          </p>
          <h2 className="text-base font-extrabold leading-tight truncate">{creation.title}</h2>
          <p className="text-xs text-white/80 mt-0.5 truncate">
            {creation.description || identity.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
