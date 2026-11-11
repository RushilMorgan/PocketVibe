import 'server-only';
import { z } from 'zod';
import { isSmartModel, SMART_MODEL_IDS } from '@/lib/ai/models';
import { MAX_REMINDERS_A_DAY, normalizeReminderTimes, REMINDER_SLOTS } from '@/lib/nudges/reminders';
import { isValidTimeZone } from '@/lib/time';
import { adminClient } from '@/lib/supabase/server';
import type { UserRow } from '@/lib/supabase/database.types';

export const settingsUpdate = z
  .object({
    display_name: z.string().trim().max(60).nullable(),
    level: z.enum(['beginner', 'some-code', 'dev']),
    tone: z.string().trim().min(1).max(40),
    /** null = back to the default (GEMINI_MODEL_PRO). */
    smart_model: z.enum(SMART_MODEL_IDS).nullable(),
    /** Reminder slots (minutes after local midnight); [] = off. Cleaned to allowed slots, at most two. */
    reminder_times: z
      .array(z.number().int())
      .max(MAX_REMINDERS_A_DAY)
      .refine((t) => t.every((m) => REMINDER_SLOTS.includes(m)), 'Pick times on the half hour from 07:00 to 21:30.')
      .transform(normalizeReminderTimes),
    /** IANA zone from the device (components/timezone-sync.tsx). */
    timezone: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone.'),
  })
  .partial();

export async function updateSettings(userId: string, patch: z.infer<typeof settingsUpdate>): Promise<UserRow> {
  const { data, error } = await adminClient().from('users').update(patch).eq('id', userId).select('*').single();
  if (error) throw error;
  return data;
}

/**
 * The user's chosen model for explainers, lessons, diagrams and chat, or
 * undefined for the default. Unknown ids (e.g. a model since removed from
 * the list) fall back to the default rather than failing.
 */
export async function getSmartModel(userId: string): Promise<string | undefined> {
  const { data, error } = await adminClient().from('users').select('smart_model').eq('id', userId).single();
  if (error) throw error;
  return isSmartModel(data.smart_model) ? data.smart_model : undefined;
}
