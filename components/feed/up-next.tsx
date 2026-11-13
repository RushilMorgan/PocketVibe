import Link from 'next/link';
import type { FeedItem, UpNextReason } from '@/components/types';
import { formatDuration } from './format';
import { Thumb } from './thumb';

const REASON: Record<UpNextReason, string> = {
  fresh: 'Fresh from today',
  whatif: 'What if it takes off?',
  review: 'Still remember this?',
  unread: 'Still unread',
};

/** The one save to do next: a big image card with What if / Review / Read and "Not now". */
export function UpNext({ item, reason, onSnooze }: { item: FeedItem; reason: UpNextReason; onSnooze: () => void }) {
  const firstLine = item.summary?.split('\n')[0];
  const duration = formatDuration(item.duration_seconds);
  const read = item.kind === 'recipe' ? 'Open recipe' : item.readMinutes ? `Read · ${item.readMinutes} min` : 'Read it';
  return (
    <section aria-label="Up next" className="overflow-hidden rounded-3xl border border-line bg-surface">
      <Link href={`/items/${item.id}`} className="relative block aspect-[4/3] bg-line">
        {/* Portrait frames keep faces in view: anchor the crop near the top third. */}
        <Thumb item={item} eager position={item.thumbnailShape === 'portrait' ? '50% 30%' : undefined} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          Up next
        </span>
        {duration && (
          <span className="absolute right-3 top-3 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-medium text-white/80">{REASON[reason]}</p>
          <h2 className="mt-1 line-clamp-3 text-xl font-bold leading-tight">{item.title}</h2>
          {firstLine && <p className="mt-1.5 line-clamp-2 text-sm text-white/85">{firstLine}</p>}
        </div>
      </Link>
      {item.related && (
        <Link
          href={`/items/${item.related.itemId}`}
          className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm"
        >
          <span aria-hidden>🔗</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted">Connects to </span>
            <span className="font-semibold">{item.related.title ?? 'another save'}</span>
          </span>
          <span aria-hidden className="text-muted">
            →
          </span>
        </Link>
      )}
      <div className="flex items-center gap-2 p-3">
        {reason === 'review' ? (
          <>
            <Link href={`/review/${item.id}`} className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-on-accent">
              {item.reviewFormat === 'connect' ? '🔗 Then and now' : '🧠 Quick recall'} · 20s
            </Link>
            <Link href={`/items/${item.id}`} className="flex-1 rounded-xl border border-line py-2.5 text-center text-sm font-medium">
              {read}
            </Link>
          </>
        ) : reason === 'whatif' ? (
          <>
            <Link
              href={`/items/${item.id}?whatif=1`}
              className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-on-accent"
            >
              🤔 What if…
            </Link>
            <Link href={`/items/${item.id}`} className="flex-1 rounded-xl border border-line py-2.5 text-center text-sm font-medium">
              {read}
            </Link>
          </>
        ) : item.lessonId ? (
          <>
            <Link
              href={`/play/${item.lessonId}`}
              className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-on-accent"
            >
              ▶ Play lesson
            </Link>
            <Link href={`/items/${item.id}`} className="flex-1 rounded-xl border border-line py-2.5 text-center text-sm font-medium">
              {read}
            </Link>
          </>
        ) : (
          <Link href={`/items/${item.id}`} className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-on-accent">
            {read}
          </Link>
        )}
        <button onClick={onSnooze} className="shrink-0 px-2 py-2.5 text-sm text-muted">
          Not now
        </button>
      </div>
    </section>
  );
}
