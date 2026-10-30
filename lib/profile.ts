import 'server-only';
import { adminClient } from '@/lib/supabase/server';

export type PromptContext = {
  level: string;
  tone: string;
  top_topics: string;
}

/** The {level}, {tone} and {top_topics} injected into every prompt. */
export async function getPromptContext(userId: string): Promise<PromptContext> {
  const db = adminClient();
  const [{ data: user, error }, { data: topics, error: topicsError }] = await Promise.all([
    db.from('users').select('level, tone').eq('id', userId).single(),
    db.from('topics').select('name').eq('user_id', userId).gt('weight', 0).order('weight', { ascending: false }).limit(5),
  ]);
  if (error) throw error;
  if (topicsError) throw topicsError;
  return {
    level: user.level,
    tone: user.tone,
    top_topics: topics?.length ? topics.map((t) => t.name).join(', ') : 'nothing yet',
  };
}
