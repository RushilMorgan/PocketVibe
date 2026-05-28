import React, { useState } from 'react';
import type { UseAuthReturn } from '../hooks/useAuth';

// ── Variant messaging ─────────────────────────────────────────────────────────

export type AuthModalVariant = 'save' | 'share' | 'claim' | 'account';

const VARIANT_COPY: Record<AuthModalVariant, { title: string; subtitle: string; skipLabel: string | null }> = {
  save: {
    title: "Save this so you don't lose it",
    subtitle: 'Create a free account to access your tools across devices.',
    skipLabel: null,
  },
  share: {
    title: 'Create a free account to manage this tool',
    subtitle: 'Keep your admin link safe and recover access from any device.',
    skipLabel: 'Continue without an account →',
  },
  claim: {
    title: 'Connect this tool to your account',
    subtitle: 'Link it to My Tools so you can manage it after login.',
    skipLabel: null,
  },
  account: {
    title: 'Sign in to Hey Toolie',
    subtitle: 'Access your tools and manage your shared creations.',
    skipLabel: null,
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AuthModalProps {
  variant: AuthModalVariant;
  auth: UseAuthReturn;
  onSuccess: () => void;
  /** For 'share' variant — lets the user bypass registration. */
  onSkip?: () => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthModal({ variant, auth, onSuccess, onSkip, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const copy = VARIANT_COPY[variant];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'signup') {
      const { error: err } = await auth.signUp(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        // Supabase may auto-confirm (depends on project settings) or send email
        setCheckEmail(true);
        // Auth state will update via onAuthStateChange; call onSuccess after brief delay
        setTimeout(() => onSuccess(), 800);
      }
    } else {
      const { error: err } = await auth.signIn(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        onSuccess();
      }
    }

    setSubmitting(false);
  }

  // ── Check email confirmation screen ──────────────────────────────────────
  if (checkEmail) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
          <span className="text-4xl">✉️</span>
          <h3 className="text-lg font-bold text-gray-900 mt-3 mb-2">Check your email</h3>
          <p className="text-sm text-gray-500">
            We've sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>

        {/* Variant-specific copy */}
        <div className="mb-5 pr-6">
          <h3 className="text-lg font-bold text-gray-900">{copy.title}</h3>
          <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(['signup', 'signin'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all
                ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {m === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <input
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 active:bg-violet-700 transition-colors"
          >
            {submitting ? '…' : mode === 'signup' ? 'Create free account' : 'Sign in'}
          </button>
        </form>

        {/* Skip option — share variant only */}
        {copy.skipLabel && onSkip && (
          <button
            onClick={onSkip}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            {copy.skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
