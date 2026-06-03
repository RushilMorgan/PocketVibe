/**
 * Tests for the Toolie user memory / profile feature:
 *  - profileService: assembleMemoryDoc (pure, no DB)
 *  - UserProfilePage: renders fields, live preview, save, delete
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { assembleMemoryDoc, type UserProfile } from '../services/profileService';
import { UserProfilePage } from '../components/UserProfilePage';

// ── Mock the hook so we control profile data ──────────────────────────────────
vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: vi.fn(),
}));
import { useUserProfile } from '../hooks/useUserProfile';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: 'u1',
    name: 'Alex',
    location: 'Cape Town, South Africa',
    whatTheyDo: 'Freelance designer',
    goals: 'Build a side hustle',
    preferences: 'Keep it simple',
    rememberNotes: 'I build things for my family.',
    ...overrides,
  };
}

// ── assembleMemoryDoc ──────────────────────────────────────────────────────────

describe('assembleMemoryDoc', () => {
  it('returns empty string for null profile', () => {
    expect(assembleMemoryDoc(null)).toBe('');
  });

  it('returns empty string when all fields are empty', () => {
    expect(assembleMemoryDoc({ userId: 'u1' })).toBe('');
  });

  it('includes only non-empty fields', () => {
    const doc = assembleMemoryDoc({ userId: 'u1', name: 'Alex', location: '' });
    expect(doc).toMatch(/Name: Alex/);
    expect(doc).not.toMatch(/Location/);
  });

  it('includes all filled fields', () => {
    const doc = assembleMemoryDoc(makeProfile());
    expect(doc).toMatch(/Name: Alex/);
    expect(doc).toMatch(/Location: Cape Town/);
    expect(doc).toMatch(/What I do: Freelance designer/);
    expect(doc).toMatch(/My goals: Build a side hustle/);
    expect(doc).toMatch(/Preferences: Keep it simple/);
    expect(doc).toMatch(/Remember: I build things for my family/);
  });

  it('starts with the "About this user" header', () => {
    const doc = assembleMemoryDoc(makeProfile());
    expect(doc).toMatch(/^\[About this user/);
  });

  it('stays under 200 tokens (approx: chars/4)', () => {
    const doc = assembleMemoryDoc(makeProfile());
    // 200 tokens ≈ 800 chars; this should be well under
    expect(doc.length).toBeLessThan(600);
  });
});

// ── UserProfilePage ────────────────────────────────────────────────────────────

describe('UserProfilePage', () => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.mocked(useUserProfile).mockReturnValue({
      profile: makeProfile(),
      loading: false,
      saving: false,
      save: mockSave,
      deleteProfile: mockDelete,
      error: null,
    });
    mockSave.mockClear();
    mockDelete.mockClear();
  });

  it('renders all 6 profile fields', () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    expect(screen.getByTestId('profile-name')).toBeInTheDocument();
    expect(screen.getByTestId('profile-location')).toBeInTheDocument();
    expect(screen.getByTestId('profile-whatTheyDo')).toBeInTheDocument();
    expect(screen.getByTestId('profile-goals')).toBeInTheDocument();
    expect(screen.getByTestId('profile-preferences')).toBeInTheDocument();
    expect(screen.getByTestId('profile-rememberNotes')).toBeInTheDocument();
  });

  it('pre-populates fields from the loaded profile', async () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect((screen.getByTestId('profile-name') as HTMLInputElement).value).toBe('Alex');
    });
  });

  it('shows live memory preview when fields are filled', async () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('profile-memory-preview')).toBeInTheDocument();
      expect(screen.getByTestId('profile-memory-preview')).toHaveTextContent('Name: Alex');
    });
  });

  it('updates preview as user types', async () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('profile-name'), { target: { value: 'Jordan' } });
    expect(screen.getByTestId('profile-memory-preview')).toHaveTextContent('Name: Jordan');
  });

  it('calls save with the current draft on Save button click', async () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('profile-save-btn'));
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it('calls deleteProfile after two taps on delete button', async () => {
    render(<UserProfilePage userId="u1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('profile-delete-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('profile-delete-btn')); // first tap: confirm
    fireEvent.click(screen.getByTestId('profile-delete-btn')); // second tap: execute
    expect(mockDelete).toHaveBeenCalledOnce();
  });
});
