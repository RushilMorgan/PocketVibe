import { splitHype } from '@/components/item/hype';
import type { Explainer } from '@/lib/handlers/schemas';

/** Small uppercase label above each section. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

/** The complete list/ranking from the content, for things the 5-line summary can't hold. */
function FullList({ list }: { list: NonNullable<Explainer['list']> }) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <section className="mt-7">
      <SectionLabel>{list.title}</SectionLabel>
      <Tag className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {list.items.map((item, i) => (
          <li key={i} className="flex gap-3 px-4 py-3">
            {list.ordered && (
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < 3 ? 'bg-accent text-on-accent' : 'bg-line text-muted'
                }`}
              >
                {i + 1}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{item.label}</span>
                {item.value && (
                  <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-sm font-bold text-accent">{item.value}</span>
                )}
              </span>
              {item.note && <span className="mt-0.5 block text-sm text-muted">{item.note}</span>}
            </span>
          </li>
        ))}
      </Tag>
    </section>
  );
}

/**
 * The explainer: key ideas as a numbered path, then why it matters, the hype
 * check and things to explore, each in its own coloured callout.
 */
export function ExplainerCard({ explainer }: { explainer: Explainer }) {
  return (
    <article>
      <section>
        <SectionLabel>The gist</SectionLabel>
        <ol className="mt-3">
          {explainer.lines.map((line, i) => {
            const last = i === explainer.lines.length - 1;
            return (
              <li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
                {!last && <span aria-hidden className="absolute bottom-0 left-[0.9rem] top-8 w-0.5 rounded-full bg-accent/20" />}
                <span
                  aria-hidden
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
                >
                  {i + 1}
                </span>
                <p className={`pt-0.5 leading-relaxed ${i === 0 ? 'text-[1.05rem] font-semibold' : ''}`}>{line}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {explainer.list && <FullList list={explainer.list} />}

      <section className="mt-7 rounded-2xl border border-accent/25 bg-accent/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-accent">
          <span aria-hidden className="text-lg">
            💡
          </span>
          Why it matters
        </p>
        <p className="mt-1.5 leading-relaxed">{explainer.why_it_matters}</p>
      </section>

      {explainer.hype_check && (
        <section className="mt-3 rounded-2xl border border-warm/30 bg-warm/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-warm">
            <span aria-hidden className="text-lg">
              🧪
            </span>
            Hype check
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {splitHype(explainer.hype_check).map((part, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                {part.label && (
                  <span
                    className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      part.label === 'Hype' ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'
                    }`}
                  >
                    {part.label === 'Hype' ? '🎈 Hype' : '✓ Solid'}
                  </span>
                )}
                <span>{part.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <SectionLabel>Go further</SectionLabel>
        <ul className="-mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {explainer.explore_next.map((thing, i) => (
            <li key={i} className="w-44 shrink-0">
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(thing)}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5"
              >
                <span className="text-sm font-semibold leading-snug">{thing}</span>
                <span className="text-xs font-medium text-accent">Search ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
