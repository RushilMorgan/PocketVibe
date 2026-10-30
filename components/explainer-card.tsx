import type { Explainer } from '@/lib/handlers/schemas';

export function ExplainerCard({ explainer }: { explainer: Explainer }) {
  return (
    <article>
      <div className="flex flex-col gap-2">
        {explainer.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

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
