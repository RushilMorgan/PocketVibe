import type { Explainer } from '@/lib/handlers/schemas';

/** The complete list/ranking from the content, for things the 5-line summary can't hold. */
function FullList({ list }: { list: NonNullable<Explainer['list']> }) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <section className="mt-5">
      <h3 className="font-semibold">{list.title}</h3>
      <Tag className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
        {list.items.map((item, i) => (
          <li key={i} className="flex gap-3 px-3 py-2.5">
            {list.ordered && (
              <span aria-hidden className="w-5 shrink-0 pt-0.5 text-right text-sm text-muted">
                {i + 1}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{item.label}</span>
                {item.value && (
                  <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-sm font-semibold text-accent">
                    {item.value}
                  </span>
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

export function ExplainerCard({ explainer }: { explainer: Explainer }) {
  return (
    <article>
      <div className="flex flex-col gap-2">
        {explainer.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {explainer.list && <FullList list={explainer.list} />}

      <p className="mt-5">
        <span className="font-semibold">Why it matters: </span>
        {explainer.why_it_matters}
      </p>

      {explainer.hype_check && (
        <p className="mt-3 rounded-lg bg-bg p-3 text-sm">
          <span className="font-semibold">Hype check: </span>
          {explainer.hype_check}
        </p>
      )}

      <h3 className="mt-5 font-semibold">Explore next</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {explainer.explore_next.map((thing, i) => (
          <li key={i}>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(thing)}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent"
            >
              {thing} ↗
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
