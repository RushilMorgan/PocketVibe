import React, { useState, useEffect } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { assembleMemoryDoc, type UserProfile } from '../services/profileService';

interface UserProfilePageProps {
  userId: string;
  onBack: () => void;
}

const FIELDS: {
  key: keyof Omit<UserProfile, 'userId'>;
  label: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  {
    key: 'name',
    label: 'What should Toolie call you?',
    placeholder: 'e.g. Alex',
  },
  {
    key: 'location',
    label: 'Where are you based?',
    placeholder: 'e.g. Cape Town, South Africa',
  },
  {
    key: 'whatTheyDo',
    label: 'What do you do?',
    placeholder: 'e.g. Freelance designer, small business owner, stay-at-home parent…',
  },
  {
    key: 'goals',
    label: 'What are you working towards?',
    placeholder: 'e.g. Building a side hustle, launching a product, learning new skills…',
    multiline: true,
  },
  {
    key: 'preferences',
    label: 'How do you like Toolie to talk to you?',
    placeholder: 'e.g. Keep it simple, be direct, give me detailed breakdowns…',
  },
  {
    key: 'rememberNotes',
    label: 'Anything else Toolie should always know?',
    placeholder: 'e.g. I build things for my family. I\'m price-sensitive. I prefer South African examples.',
    multiline: true,
  },
];

export function UserProfilePage({ userId, onBack }: UserProfilePageProps) {
  const { profile, loading, saving, save, deleteProfile, error } = useUserProfile(userId);

  // Local draft — keeps unsaved changes
  const [draft, setDraft] = useState<Omit<UserProfile, 'userId'>>({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate draft once the profile loads
  useEffect(() => {
    if (profile) {
      const { userId: _id, ...rest } = profile;
      setDraft(rest);
    }
  }, [profile]);

  function updateField(key: keyof Omit<UserProfile, 'userId'>, value: string) {
    setDraft(d => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await save(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteProfile();
    setDraft({});
    setConfirmDelete(false);
    onBack();
  }

  // Live preview of what Toolie will actually see
  const memoryPreview = assembleMemoryDoc({ userId, ...draft });
  const hasDraft = Object.values(draft).some(v => v?.trim());

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 active:bg-gray-200 flex-shrink-0"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-tight">Your Toolie Profile</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Toolie reads this before every response to personalise what it builds for you.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 space-y-5">

        {/* Fields */}
        {FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                data-testid={`profile-${field.key}`}
                value={(draft[field.key] as string) ?? ''}
                onChange={e => updateField(field.key, e.target.value)}
                rows={3}
                maxLength={300}
                placeholder={field.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
              />
            ) : (
              <input
                data-testid={`profile-${field.key}`}
                type="text"
                value={(draft[field.key] as string) ?? ''}
                onChange={e => updateField(field.key, e.target.value)}
                maxLength={120}
                placeholder={field.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
              />
            )}
          </div>
        ))}

        {/* Live preview */}
        {hasDraft && (
          <div data-testid="profile-memory-preview" className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-violet-500 text-xs">✦</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">
                What Toolie will know about you
              </p>
            </div>
            <p className="text-xs text-violet-800 whitespace-pre-wrap leading-relaxed font-mono">
              {memoryPreview}
            </p>
          </div>
        )}

        {/* Privacy note */}
        <div className="bg-gray-50 rounded-2xl p-4 flex items-start gap-2.5">
          <span className="text-sm flex-shrink-0 mt-0.5">🔒</span>
          <p className="text-xs text-gray-500 leading-relaxed">
            Only you can see this. Toolie uses it to personalise things it builds for you —
            it never shares this with anyone.
          </p>
        </div>

        {/* Delete */}
        <div className="pt-2">
          <button
            data-testid="profile-delete-btn"
            onClick={handleDelete}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
              confirmDelete
                ? 'bg-red-500 text-white active:bg-red-600'
                : 'text-red-400 active:bg-red-50'
            }`}
          >
            {confirmDelete ? 'Tap again to confirm delete' : 'Delete my profile'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Save bar */}
      <div className="px-4 pb-6 pt-3 border-t border-gray-100 bg-white flex-shrink-0 flex items-center gap-3">
        <button
          data-testid="profile-save-btn"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-violet-600 text-white text-sm font-bold active:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
