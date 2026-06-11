import { useState, type ReactNode } from 'react';

interface VideoThumbProps {
  src: string;
  className?: string;
  /** Shown instead when the image fails or YouTube serves its grey placeholder. */
  fallback?: ReactNode;
}

/**
 * A video thumbnail that knows when it's lying: YouTube answers requests for
 * missing/removed videos with a real, loadable 120×90 grey placeholder image
 * (so onError never fires). Real hqdefault thumbnails are 480×360 — anything
 * 120px or narrower gets swapped for the fallback.
 */
export function VideoThumb({ src, className, fallback = null }: VideoThumbProps) {
  const [broken, setBroken] = useState(false);
  if (broken) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={className}
      onError={() => setBroken(true)}
      onLoad={e => {
        if (e.currentTarget.naturalWidth <= 120) setBroken(true);
      }}
    />
  );
}
