import { useState } from 'react';
import { X, Loader2, CheckCircle2, Mail } from 'lucide-react';
import type { SiteConfig } from '../../types';
import { supabase, supabaseReady } from '../../lib/supabaseClient';

interface ClaimSiteModalProps {
  siteConfig: SiteConfig;
  onClose: () => void;
}

type ModalState = 'form' | 'loading' | 'success';

export default function ClaimSiteModal({ siteConfig, onClose }: ClaimSiteModalProps) {
  const [email, setEmail] = useState('');
  const [modalState, setModalState] = useState<ModalState>('form');
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!supabaseReady) {
      setError(
        'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local',
      );
      return;
    }

    setError('');
    setModalState('loading');

    try {
      // ── Step 1: Create / sign-in user via magic link ──────────────────────
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (authError) throw authError;

      // ── Step 2: Persist site config to `sites` table ──────────────────────
      const { error: dbError } = await supabase.from('sites').insert({
        email: trimmed,
        business_name: siteConfig.businessName,
        subdomain: siteConfig.subdomain,
        config: {
          businessName: siteConfig.businessName,
          businessDescription: siteConfig.businessDescription,
          theme: siteConfig.theme,
          headline: siteConfig.headline,
          subheadline: siteConfig.subheadline,
          ctaText: siteConfig.ctaText,
          colors: siteConfig.colors,
        },
        is_live: true,
      });

      if (dbError) {
        // Friendly message for duplicate subdomain
        if (dbError.code === '23505') {
          throw new Error(
            'That subdomain is already taken. Try a slightly different business name.',
          );
        }
        throw dbError;
      }

      setSubdomain(siteConfig.subdomain);
      setModalState('success');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const isRateLimit =
        raw.toLowerCase().includes('rate limit') ||
        raw.toLowerCase().includes('too many') ||
        (err as { status?: number })?.status === 429;
      const message = isRateLimit
        ? 'Too many sign-in emails sent. Please wait a few minutes, then try again — or check your inbox for an earlier magic link.'
        : raw || 'Something went wrong. Please try again.';
      setError(message);
      setModalState('form');
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="relative w-full bg-white rounded-t-3xl p-6 z-10 animate-slide-up">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Form ── */}
        {modalState === 'form' && (
          <>
            <div className="mb-5 pr-8">
              <p className="text-3xl mb-1">🚀</p>
              <h2 className="text-xl font-bold text-gray-900">Claim your site</h2>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                Enter your email to save your work and go live instantly.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <input
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 transition-all"
                  style={{ boxShadow: 'none' }}
                  autoFocus
                  autoComplete="email"
                />
                {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
                }}
              >
                ✨ Claim My Site — It's Free
              </button>

              <p className="text-xs text-gray-400 text-center">
                No credit card required. Free forever for your first site.
              </p>
            </form>
          </>
        )}

        {/* ── Loading ── */}
        {modalState === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
            <div className="text-center">
              <p className="font-bold text-gray-800 text-lg">Saving your site...</p>
              <div className="flex flex-col gap-1 mt-2">
                <p className="text-sm text-gray-500">✅ Creating your account</p>
                <p className="text-sm text-gray-500">✅ Saving site config to database</p>
                <p className="text-sm text-violet-500 font-medium">⏳ Deploying subdomain 🌐</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {modalState === 'success' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="text-5xl">🎉</div>
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">You're live!</h2>
              <p className="text-gray-500 text-sm mt-1">Site saved to database. Published at:</p>
            </div>
            <div
              className="w-full rounded-xl px-4 py-3"
              style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}
            >
              <p className="text-sm font-mono font-bold text-violet-600 break-all">
                {subdomain}
              </p>
            </div>
            {/* Magic link confirmation */}
            <div
              className="w-full rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <Mail className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800 text-left leading-relaxed">
                A magic link has been sent to <strong>{email}</strong>. Click it to log in and
                manage your site.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors active:scale-[0.97]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
