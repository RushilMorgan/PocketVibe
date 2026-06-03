/**
 * Client-side CRUD for user profiles ("Toolie memory").
 * The profile is stored per signed-in user and injected into the AI system
 * prompt on every generation so Toolie already knows the user before they type.
 */
import { supabase } from '../lib/supabaseClient';

export interface UserProfile {
  userId:        string;
  name?:         string;
  location?:     string;
  whatTheyDo?:   string;
  goals?:        string;
  preferences?:  string;
  rememberNotes?: string;
}

function toRow(profile: Omit<UserProfile, 'userId'>) {
  return {
    name:           profile.name           ?? null,
    location:       profile.location       ?? null,
    what_they_do:   profile.whatTheyDo     ?? null,
    goals:          profile.goals          ?? null,
    preferences:    profile.preferences    ?? null,
    remember_notes: profile.rememberNotes  ?? null,
    updated_at:     new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): UserProfile {
  return {
    userId:        row.user_id        as string,
    name:          (row.name          as string | null) ?? undefined,
    location:      (row.location      as string | null) ?? undefined,
    whatTheyDo:    (row.what_they_do  as string | null) ?? undefined,
    goals:         (row.goals         as string | null) ?? undefined,
    preferences:   (row.preferences   as string | null) ?? undefined,
    rememberNotes: (row.remember_notes as string | null) ?? undefined,
  };
}

/** Load the profile for the given user. Returns null if none exists. */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow(data as Record<string, unknown>);
}

/** Save (upsert) the profile for the given user. */
export async function saveProfile(
  userId: string,
  profile: Omit<UserProfile, 'userId'>,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...toRow(profile) }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/** Permanently delete the user's profile (GDPR / right to erasure). */
export async function deleteProfile(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Assemble the memory doc that gets injected into the AI system prompt.
 * Empty fields are omitted. Returns '' if no profile or no fields filled.
 * Target: ≤150 tokens.
 */
export function assembleMemoryDoc(profile: UserProfile | null): string {
  if (!profile) return '';
  const parts: string[] = [];
  if (profile.name?.trim())          parts.push(`Name: ${profile.name.trim()}`);
  if (profile.location?.trim())      parts.push(`Location: ${profile.location.trim()}`);
  if (profile.whatTheyDo?.trim())    parts.push(`What I do: ${profile.whatTheyDo.trim()}`);
  if (profile.goals?.trim())         parts.push(`My goals: ${profile.goals.trim()}`);
  if (profile.preferences?.trim())   parts.push(`Preferences: ${profile.preferences.trim()}`);
  if (profile.rememberNotes?.trim()) parts.push(`Remember: ${profile.rememberNotes.trim()}`);
  if (parts.length === 0) return '';
  return `[About this user — personalise your response using this context]\n${parts.join('\n')}`;
}
