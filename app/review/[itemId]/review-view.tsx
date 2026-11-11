"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Thumb } from "@/components/feed/thumb";
import type { ReviewCard } from "@/lib/reviews/types";
import type { ReviewRating } from "@/lib/supabase/database.types";

type CardSave = ReviewCard["save"];

const RATINGS: { value: ReviewRating; emoji: string; label: string }[] = [
  { value: "forgot", emoji: "😬", label: "Forgot" },
  { value: "fuzzy", emoji: "🤔", label: "Fuzzy" },
  { value: "got", emoji: "😎", label: "Got it" },
];

const DONE: Record<
  ReviewRating,
  { emoji: string; title: string; body: string }
> = {
  got: { emoji: "🧠", title: "Locked in.", body: "That one is sticking." },
  fuzzy: {
    emoji: "👍",
    title: "Getting there.",
    body: "You'll see it again at the same gap.",
  },
  forgot: {
    emoji: "🌱",
    title: "No worries.",
    body: "It'll come back sooner — that's how it sticks.",
  },
};

/**
 * A review card: the question side (recall the key ideas, or how two saves
 * connect), flip to the answer, rate yourself, see when it comes back.
 */
export function ReviewView({ itemId }: { itemId: string }) {
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<{
    rating: ReviewRating;
    next: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ card: ReviewCard }>(`/api/reviews/${itemId}`).then(
      (r) => setCard(r.card),
      (err) =>
        setError(err instanceof Error ? err.message : "Something went wrong"),
    );
  }, [itemId]);

  async function rate(rating: ReviewRating) {
    if (!card) return;
    setSaving(true);
    try {
      const { next } = await api<{ next: string }>(`/api/reviews/${itemId}`, {
        body: { format: card.format, rating },
      });
      setRated({ rating, next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const connect = card?.format === "connect" && card.other && card.connection;

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-lg ring-1 ring-line"
        >
          ✕
        </Link>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
          {connect ? "Then and now" : "Quick recall"} · 20s
        </span>
        <span className="w-10" />
      </header>

      {error && <p className="mt-10 text-center text-danger">{error}</p>}
      {!card && !error && (
        <div className="mt-8 h-96 animate-pulse rounded-3xl bg-line motion-reduce:animate-none" />
      )}

      {card && !rated && (
        <main className="mt-6 flex flex-1 flex-col">
          {!flipped ? (
            <>
              {connect ? (
                <ConnectFront card={card} />
              ) : (
                <RecallFront save={card.save} />
              )}
              <button
                onClick={() => setFlipped(true)}
                className="mt-auto w-full rounded-2xl bg-accent py-4 text-lg font-bold text-on-accent shadow-lg shadow-accent/25 active:scale-[0.99]"
              >
                Flip ↻
              </button>
              <p className="mt-2 text-center text-xs text-muted">
                Answer in your head first — that&apos;s what makes it stick.
              </p>
            </>
          ) : (
            <div className="animate-card-flip flex flex-1 flex-col">
              {connect ? (
                <ConnectBack card={card} />
              ) : (
                <RecallBack save={card.save} />
              )}
              {/* Pinned, so long answers never push the rating off screen. */}
              <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-bg/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
                <p className="text-center text-sm font-semibold">
                  How did you do?
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => rate(r.value)}
                      disabled={saving}
                      className={`flex flex-col items-center gap-1 rounded-2xl border py-3.5 disabled:opacity-50 ${
                        r.value === "got"
                          ? "border-success bg-success/10"
                          : r.value === "forgot"
                            ? "border-danger/40 bg-danger/5"
                            : "border-line bg-surface"
                      }`}
                    >
                      <span aria-hidden className="text-2xl">
                        {r.emoji}
                      </span>
                      <span className="text-sm font-semibold">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {rated && card && (
        <main className="animate-card-flip mt-16 flex flex-1 flex-col items-center text-center">
          <p aria-hidden className="text-6xl">
            {DONE[rated.rating].emoji}
          </p>
          <h1 className="mt-4 text-2xl font-extrabold">
            {DONE[rated.rating].title}
          </h1>
          <p className="mt-1 text-muted">{DONE[rated.rating].body}</p>
          <p className="mt-4 rounded-full bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line">
            {rated.next}
          </p>
          <div className="mt-auto flex w-full flex-col gap-2">
            <Link
              href="/"
              className="rounded-2xl bg-accent py-3.5 font-bold text-on-accent"
            >
              Back to saves
            </Link>
            <Link
              href={`/items/${card.save.id}`}
              className="rounded-2xl border border-line bg-surface py-3.5 font-semibold"
            >
              Open the save
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}

function RecallFront({ save }: { save: CardSave }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative aspect-[3/4] w-56 overflow-hidden rounded-3xl bg-line shadow-xl shadow-black/20">
        <Thumb item={save} eager position="50% 30%" />
      </div>
      <h1 className="mt-5 text-xl font-extrabold leading-tight">
        {save.title}
      </h1>
      <p className="mt-6 text-2xl font-bold">What were the key ideas?</p>
      <p className="mt-1 text-sm text-muted">
        Try to name {Math.min(3, save.ideas.length) || 2} before you flip.
      </p>
    </div>
  );
}

function RecallBack({ save }: { save: CardSave }) {
  return (
    <div>
      <p className="text-sm font-semibold text-muted">{save.title}</p>
      <ol className="mt-4 flex flex-col gap-3">
        {save.ideas.map((idea, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
              {i + 1}
            </span>
            <span className="leading-relaxed">{idea}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Older save first: "then", then "now". */
function ordered(card: ReviewCard): [CardSave, CardSave] {
  const a = card.save;
  const b = card.other!;
  return a.created_at <= b.created_at ? [a, b] : [b, a];
}

function ConnectFront({ card }: { card: ReviewCard }) {
  const [then, now] = ordered(card);
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <MiniSave save={then} label="Then" />
        <span aria-hidden className="text-2xl text-muted">
          🔗
        </span>
        <MiniSave save={now} label="Now" />
      </div>
      <p className="mt-8 text-2xl font-bold">How do these two connect?</p>
      <p className="mt-1 text-sm text-muted">
        Think of one idea they share, and one thing that&apos;s different.
      </p>
    </div>
  );
}

function ConnectBack({ card }: { card: ReviewCard }) {
  const [then, now] = ordered(card);
  return (
    <div>
      <div className="rounded-3xl border border-accent/25 bg-accent/10 p-4">
        <p className="text-sm font-bold text-accent">🔗 The connection</p>
        <ul className="mt-2 flex flex-col gap-2">
          {card.connection!.map((line, i) => (
            <li key={i} className="leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </div>
      {[then, now].map((s, i) => (
        <Link
          key={s.id}
          href={`/items/${s.id}`}
          className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5"
        >
          <span className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-line">
            <Thumb item={s} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
              {i === 0 ? "Then" : "Now"}
            </span>
            <span className="line-clamp-2 text-sm font-semibold leading-snug">
              {s.title}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function MiniSave({ save, label }: { save: CardSave; label: string }) {
  return (
    <div className="w-36">
      <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-line shadow-lg shadow-black/20">
        <Thumb item={save} eager position="50% 30%" />
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">
        {save.title}
      </p>
    </div>
  );
}
