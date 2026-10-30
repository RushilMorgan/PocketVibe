'use client';

import { useEffect, useState } from 'react';

/**
 * Diagram PNG with its one-line caption. Tap opens it full-screen, where the
 * browser's own pinch-zoom and scrolling work; tap again or Esc to close.
 */
export function DiagramCard({ src, caption }: { src: string; caption: string }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setZoomed(false);
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [zoomed]);

  return (
    <figure className="mt-5">
      <button
        onClick={() => setZoomed(true)}
        aria-label="Open diagram full screen"
        className="block w-full overflow-hidden rounded-xl border border-line bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static PNG from Storage, already sized */}
        <img src={src} alt={caption} className="w-full" loading="lazy" />
      </button>
      <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caption}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 overflow-auto bg-black/90 p-2"
          style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={caption} className="mx-auto min-w-[150%] max-w-none bg-white sm:min-w-0 sm:max-w-full" />
          <p className="mt-3 text-center text-sm text-white/70">Tap to close</p>
        </div>
      )}
    </figure>
  );
}
