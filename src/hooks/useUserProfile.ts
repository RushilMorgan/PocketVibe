import { useState, useEffect, useCallback } from 'react';
import { getProfile, saveProfile, deleteProfile, type UserProfile } from '../services/profileService';

interface UseUserProfileReturn {
  profile:       UserProfile | null;
  loading:       boolean;
  saving:        boolean;
  /** Save the profile (merge with current, then persist). */
  save:          (updates: Omit<UserProfile, 'userId'>) => Promise<void>;
  /** Permanently delete the profile row. */
  deleteProfile: () => Promise<void>;
  /** Error from the last save/delete, if any. */
  error:         string | null;
}

/**
 * Load and manage the Toolie profile for the given user.
 * Fetches on mount; re-fetches if userId changes (sign-in / sign-out).
 */
export function useUserProfile(userId?: string): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    setLoading(true);
    getProfile(userId).then(p => {
      if (!cancelled) { setProfile(p); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const save = useCallback(async (updates: Omit<UserProfile, 'userId'>) => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile(userId, updates);
      setProfile({ userId, ...updates });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const del = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProfile(userId);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete profile');
    } finally {
      setSaving(false);
    }
  }, [userId]);

  return { profile, loading, saving, save, deleteProfile: del, error };
}
