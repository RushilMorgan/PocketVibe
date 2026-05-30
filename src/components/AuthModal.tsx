import React, { useState } from 'react';
import type { UseAuthReturn } from '../hooks/useAuth';

// ── Variant messaging ─────────────────────────────────────────────────────────

export type AuthModalVariant = 'save' | 'share' | 'claim' | 'account';

const VARIANT_COPY: Record<AuthModalVariant, { title: string; subtitle: string; skipLabel: string | null }> = {
  save: {
    title: "Save this so only you can manage it.",
    subtitle: 'Create a free account to access your tools across devices.',
    skipLabel: null,
  },
  share: {
    title: 'Create a free account to keep your admin access safe.',
    subtitle: 'Sign in to manage this tool later.',
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
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const copy = VARIANT_COPY[variant];

  // ── Magic link sent ───────────────────────────────────────────────────────

  if (magicSent) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
          <span className="text-4xl">✉️</span>
          <h3 className="text-lg font-bold text-gray-900 mt-3 mb-2">Check your email</h3>
          <p className="text-sm text-gray-500">
            We've sent a sign-in link to <strong>{magicEmail}</strong>.
            Click it to sign in — no password needed.
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

  // ── Password form confirmation (signup email sent) ─────────────────────────

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

  // ── OAuth handlers ────────────────────────────────────────────────────────

  async function handleGoogle() {
    setError(null);
    const { error: err } = await auth.signInWithGoogle();
    if (err) setError(err);
    // On success, browser will redirect — no onSuccess call needed here
  }

  async function handleApple() {
    setError(null);
    const { error: err } = await auth.signInWithApple();
    if (err) setError(err);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setError(null);
    setSubmitting(true);
    const { error: err } = await auth.signInWithMagicLink(magicEmail.trim());
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setMagicSent(true);
    }
  }

  // ── Password form submit ──────────────────────────────────────────────────

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    if (mode === 'signup') {
      const { error: err } = await auth.signUp(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        setCheckEmail(true);
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

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>

        {/* Variant copy */}
        <div className="mb-5 pr-6">
          <h3 className="text-lg font-bold text-gray-900">{copy.title}</h3>
          <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
        )}

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3 mb-4">
          <button
            data-testid="google-signin-btn"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            data-testid="apple-signin-btn"
            onClick={handleApple}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.8 0 663.4 0 541.3 0 343.7 112.8 210.1 309.8 210.1c78.2 0 145.7 52.8 195.6 52.8 47.4 0 121.9-55.8 211.3-55.8 33.7-.1 134.3 4.5 200.4 133.8zm-250-181.8C557 90.4 579 28.5 579 0c0-4.6-.7-9.2-1.3-13.8-49.7 2-106.3 33.2-139.9 69.9-30 32.6-59.3 88.3-59.3 147.6 0 5.3 1.3 10.5 1.9 12.3 3.2.5 8.5 1.3 13.8 1.3 45.9 0 98.4-29.4 133.9-98.2z" fill="currentColor"/>
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Magic link */}
        <form onSubmit={handleMagicLink} className="flex flex-col gap-2 mb-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="your@email.com"
            value={magicEmail}
            onChange={e => setMagicEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button
            data-testid="magic-link-btn"
            type="submit"
            disabled={submitting || !magicEmail.trim()}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 active:bg-violet-700 transition-colors"
          >
            {submitting ? '…' : 'Email me a sign-in link'}
          </button>
        </form>

        {/* Password toggle */}
        {!showPassword ? (
          <button
            onClick={() => { setShowPassword(true); setError(null); }}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            Sign in with password ›
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
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
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2">
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
              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 active:bg-gray-800 transition-colors"
              >
                {submitting ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </div>
        )}

        {/* Skip option — share variant only */}
        {copy.skipLabel && onSkip && (
          <button
            data-testid="auth-skip-btn"
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
