import Link from 'next/link';
import { KIND_LABEL, type FeedItem } from '@/components/types';
import { formatDuration, metaLine, scoreLabel } from './format';
import { Thumb } from './thumb';

/** One save in the grid: a 4:5 image with its kind and state on top, title and one meta line below. */
export function FeedCard({ item }: { item: FeedItem }) {
  const working = item.state === 'working';
  const failed = item.state === 'failed';
  const duration = formatDuration(item.duration_seconds);
  return (
    <Link href={`/items/${item.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-line">
        <div className={`h-full w-full transition-transform duration-300 group-active:scale-[0.98] ${failed ? 'opacity-50 grayscale' : ''}`}>
          <Thumb item={item} />
        </div>

        {working && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
              {metaLine(item)}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
          {item.kind ? <Pill>{KIND_LABEL[item.kind]}</Pill> : <span />}
          <StateMark item={item} />
        </div>
        {item.related && (
          <span
            title={`Connects to ${item.related.title ?? 'another save'}`}
            className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white"
          >
            🔗
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{item.title ?? hostname(item.url)}</p>
      <p className={`mt-0.5 truncate text-xs ${failed ? 'text-danger' : 'text-muted'}`}>{working ? 'Working on it…' : metaLine(item)}</p>
    </Link>
  );
}

function StateMark({ item }: { item: FeedItem }) {
  switch (item.state) {
    case 'new':
      return <span aria-label="New" className="mt-1 mr-1 h-3 w-3 rounded-full bg-accent ring-2 ring-white" />;
    case 'lesson_ready':
      return <span className="rounded-full bg-accent px-2 py-1 text-[11px] font-semibold text-on-accent">▶ Lesson</span>;
    case 'played':
      return <Pill>{scoreLabel(item.bestScore)}</Pill>;
    case 'mastered':
      return <span className="rounded-full bg-success px-2 py-1 text-[11px] font-semibold text-on-accent">✓ Mastered</span>;
    default:
      return null;
  }
}

/** A label on top of a photo: dark scrim so it reads on any image, in either theme. */
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">{children}</span>;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
