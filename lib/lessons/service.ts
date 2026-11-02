import 'server-only';
import { z } from 'zod';
import { generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { logEvent } from '@/lib/events';
import { HttpError } from '@/lib/http';
import { getItem, insertOutput } from '@/lib/items/service';
import { adjustItemTopics, getPromptContext, WEIGHT } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import { lesson, maxScore, shuffleAnswers, templateSchema, TEMPLATES, type Lesson, type Template } from './schema';

const CONTEXT_CHARS = 20_000;

const pick = z.object({ template: z.enum(TEMPLATES), reason: z.string() });

export interface LessonView {
  id: string;
  itemId: string;
  itemTitle: string;
  itemKind: string | null;
  content: Lesson;
}

/**
 * Writes a lesson for an item and saves it as a new output. A cheap Flash call
 * picks the template that fits (unless the user chose one), then Gemini Pro
 * writes JSON for just that template's schema. Invalid JSON is regenerated
 * once, then it gives up. Concepts already covered by earlier lessons are
 * passed as "avoid", so "Another on this topic" teaches something new.
 */
export async function createLesson(userId: string, itemId: string, chosen?: Template): Promise<string> {
  const item = await getItem(userId, itemId);
  if (!item.raw_text) throw new HttpError(409, "This one hasn't been read yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no lesson.');

  const covered = item.outputs
    .filter((o) => o.type === 'lesson')
    .map((o) => (o.content as { concept?: string }).concept)
    .filter(Boolean);
  const avoid = covered.length
    ? `Already covered for this person: ${covered.join('; ')}. Pick a different concept from the content, or go one level deeper on one of these.`
    : '';

  const source = { text: `Title: ${item.title ?? ''}\nContent:\n${item.raw_text.slice(0, CONTEXT_CHARS)}` };
  const template = chosen ?? (await pickTemplate(source));

  const instructions = await prompt('lesson', {
    ...(await getPromptContext(userId)),
    template,
    template_rules: await prompt(`lesson-${template}`, {}),
    avoid,
  });
  const schema = templateSchema[template] as unknown as z.ZodType<Lesson>;

  let content: Lesson | undefined;
  for (let attempt = 0; attempt < 2 && !content; attempt++) {
    try {
      content = await generateJson(schema, [{ text: instructions }, source], { model: 'pro' });
    } catch (err) {
      console.warn('lesson: attempt', attempt + 1, 'invalid', template, err);
    }
  }
  if (!content) throw new HttpError(422, "Couldn't build a lesson from this one.");
  if (content.template === 'quiz') content = shuffleAnswers(content, Date.now());

  return insertOutput(userId, itemId, 'lesson', content);
}

/** Flash picks the template; quiz if the call fails (it fits any concept). */
async function pickTemplate(source: { text: string }): Promise<Template> {
  try {
    const { template } = await generateJson(pick, [{ text: await prompt('lesson-pick', {}) }, source]);
    return template;
  } catch (err) {
    console.warn('lesson: template pick failed, using quiz', err);
    return 'quiz';
  }
}

/** The newest lesson for an item that hasn't been played yet, if any. */
export async function unplayedLesson(userId: string, itemId: string): Promise<string | null> {
  const db = adminClient();
  const [{ data: lessons, error }, { data: played, error: playedError }] = await Promise.all([
    db.from('item_outputs').select('id, created_at').eq('item_id', itemId).eq('user_id', userId).eq('type', 'lesson').order('created_at', { ascending: false }),
    db.from('events').select('created_at').eq('item_id', itemId).eq('user_id', userId).eq('type', 'played').order('created_at', { ascending: false }).limit(1),
  ]);
  if (error) throw error;
  if (playedError) throw playedError;
  const lastPlayed = played?.[0]?.created_at;
  const fresh = (lessons ?? []).find((l) => !lastPlayed || l.created_at > lastPlayed);
  return fresh?.id ?? null;
}

export async function getLesson(userId: string, lessonId: string): Promise<LessonView> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) throw new HttpError(404, 'Lesson not found.');
  const db = adminClient();
  const { data, error } = await db
    .from('item_outputs')
    .select('id, item_id, content')
    .eq('id', lessonId)
    .eq('user_id', userId)
    .eq('type', 'lesson')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Lesson not found.');
  const { data: item, error: itemError } = await db.from('items').select('title, url, kind').eq('id', data.item_id).single();
  if (itemError) throw itemError;
  return {
    id: data.id,
    itemId: data.item_id,
    itemTitle: item.title ?? item.url,
    itemKind: item.kind,
    content: lesson.parse(data.content),
  };
}

/**
 * Logs a play: 'played' once per lesson run and 'score' with the fraction of
 * the template's best score, and nudges the item's topics up.
 */
export async function recordResult(userId: string, lessonId: string, score: number): Promise<void> {
  const { itemId, content } = await getLesson(userId, lessonId);
  const total = maxScore(content);
  if (score < 0 || score > total) throw new HttpError(400, 'Score out of range.');
  await logEvent(userId, 'played', { itemId });
  await logEvent(userId, 'score', { itemId, value: score / total });
  await adjustItemTopics(userId, itemId, WEIGHT.play);
}
