import 'server-only';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/server';
import type { UserRow } from '@/lib/supabase/database.types';

export const settingsUpdate = z
  .object({
    display_name: z.string().trim().max(60).nullable(),
    level: z.enum(['beginner', 'some-code', 'dev']),
    tone: z.string().trim().min(1).max(40),
  })
  .partial();

export async function updateSettings(userId: string, patch: z.infer<typeof settingsUpdate>): Promise<UserRow> {
  const { data, error } = await adminClient().from('users').update(patch).eq('id', userId).select('*').single();
  if (error) throw error;
  return data;
}
