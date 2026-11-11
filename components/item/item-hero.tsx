'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDuration, shortAgo } from '@/components/feed/format';
import { Thumb } from '@/components/feed/thumb';
import { KIND_LABEL, type Item } from '@/components/types';

/** "YouTube Short", "TikTok", or the site's name. */
export function sourceLabel(item: Pick<Item, 'url' | 'source'>): string {
  try {
    const u = new URL(item.url);
    if (item.source === 'youtube') return u.pathname.startsWith('/shorts/') ? 'YouTube Short' : 'YouTube';
    if (item.source === 'tiktok') return 'TikTok';
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

function savedAgo(iso: string): string {
  const age = shortAgo(iso);
  return age === 'now' ? 'Saved just now' : `Saved ${age} ago`;
}

function isPortrait(item: Pick<Item, 'url' | 'source'>): boolean {
  if (item.source === 'tiktok') return true;
  try {
    return new URL(item.url).pathname.startsWith('/shorts/');
  } catch {
    return false;
  }
}

/**
 * Full-bleed header for an item: portrait videos sit centred on a blurred copy
 * of their own frame, landscape images fill the width. Back and "Watch" float
 * on top; title and meta sit underneath.
 */
export function ItemHero({ item, title }: { item: Item; title: string | null }) {
  const [bgOk, setBgOk] = useState(true);
  const portrait = isPortrait(item);
  const duration = formatDuration(item.duration_seconds);
  const watch = item.source === 'youtube' || item.source === 'tiktok' ? 'Watch' : 'Open';

  return (
    <header>
      <div className={`relative -mx-4 -mt-6 overflow-hidden bg-ink ${portrait ? 'h-[22rem]' : 'aspect-video'}`}>
        {portrait ? (
          <>
            {item.thumbnail_url && bgOk && (
              // eslint-disable-next-line @next/next/no-img-element -- backdrop copy of the source's own image
              <img
                src={item.thumbnail_url}
                alt=""
                aria-hidden
                referrerPolicy="no-referrer"
                onError={() => setBgOk(false)}
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 top-14 flex justify-center pb-6">
              <div className="aspect-[9/16] h-full overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/15">
                <Thumb item={item} eager />
              </div>
            </div>
          </>
        ) : (
          <Thumb item={item} eager />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

        <Link
          href="/"
          aria-label="All saves"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur-md"
        >
          ←
        </Link>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="absolute right-4 top-4 flex h-10 items-center gap-1.5 rounded-full bg-black/50 px-3.5 text-sm font-semibold text-white backdrop-blur-md"
        >
          {watch} {duration && <span className="font-normal text-white/75">{duration}</span>} ↗
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
        {item.kind && <span className="rounded-full bg-accent/10 px-2.5 py-1 font-semibold text-accent">{KIND_LABEL[item.kind]}</span>}
        <span className="rounded-full bg-surface px-2.5 py-1 text-muted ring-1 ring-line">{sourceLabel(item)}</span>
        <span className="rounded-full bg-surface px-2.5 py-1 text-muted ring-1 ring-line">{savedAgo(item.created_at)}</span>
      </div>
      <h1 className="mt-2.5 text-[1.65rem] font-extrabold leading-[1.15] tracking-tight">{title ?? sourceLabel(item)}</h1>
    </header>
  );
}
