'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { QuizPlayer } from '@/components/lessons/quiz-player';
import type { Lesson } from '@/lib/lessons/schema';

interface LessonView {
  id: string;
  itemId: string;
  itemTitle: string;
  content: Lesson;
}

/** Results that couldn't be sent (offline) wait here and go out on the next play. */
const PENDING_KEY = 'heytoolie:pending-results';

function readPending(): { lessonId: string; score: number }[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writePending(list: { lessonId: string; score: number }[]) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

async function sendResult(lessonId: string, score: number): Promise<boolean> {
  try {
    await api(`/api/lessons/${lessonId}/result`, { body: { score } });
    return true;
  } catch {
    return false;
  }
}

/** Loads the lesson and hands it to the right template (only quiz until Phase 4). */
export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [another, setAnother] = useState<'idle' | 'working' | 'failed'>('idle');

  useEffect(() => {
    api<{ lesson: LessonView }>(`/api/lessons/${lessonId}`).then(
      (r) => setLesson(r.lesson),
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
    );
    // Flush any results saved while offline.
    (async () => {
      const left = [];
      for (const r of readPending()) if (!(await sendResult(r.lessonId, r.score))) left.push(r);
      writePending(left);
    })();
  }, [lessonId]);

  async function finish(score: number) {
    if (!(await sendResult(lessonId, score))) writePending([...readPending(), { lessonId, score }]);
  }

  async function playAnother() {
    if (!lesson) return;
    setAnother('working');
    try {
      const { lessonId: next } = await api<{ lessonId: string }>('/api/lessons', { body: { itemId: lesson.itemId, fresh: true } });
      router.replace(`/play/${next}`);
    } catch {
      setAnother('failed');
    }
  }

  if (error) {
    return (
      <Screen>
        <p className="text-lg font-medium">Couldn&apos;t open this lesson</p>
        <p className="mt-1 text-muted">{error}</p>
        <Link href="/" className="mt-6 inline-block text-accent">
          ← Back to your saves
        </Link>
      </Screen>
    );
  }

  if (!lesson) {
    return (
      <Screen>
        <p className="text-muted">Loading…</p>
      </Screen>
    );
  }

  return (
    <QuizPlayer
      key={lesson.id}
      quiz={lesson.content}
      itemHref={`/items/${lesson.itemId}`}
      onFinish={finish}
      onAnother={playAnother}
      anotherState={another}
    />
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 flex flex-col justify-center bg-bg px-6">{children}</div>;
}
