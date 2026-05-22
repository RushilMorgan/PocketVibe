import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { OnboardingStep, SiteBuilderAction } from '../../types';

interface OnboardingOverlayProps {
  step: OnboardingStep;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

const STEPS = ['🎨 Designing layout...', '📝 Writing your content...', '🚀 Final touches...'];

export default function OnboardingOverlay({ step, dispatch }: OnboardingOverlayProps) {
  const [businessName, setBusinessName] = useState('Paws & Suds Mobile Grooming');
  const [businessDescription, setBusinessDescription] = useState('Mobile dog washing');
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState(STEPS[0]);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (step !== 'animating') return;

    setProgress(0);
    setFadeOut(false);

    const startTime = Date.now();
    const duration = 3000;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      setStepLabel(pct < 33 ? STEPS[0] : pct < 70 ? STEPS[1] : STEPS[2]);

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        setFadeOut(true);
        setTimeout(() => dispatch({ type: 'ANIMATION_COMPLETE' }), 450);
      }
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, dispatch]);

  const handleGenerate = () => {
    if (!businessName.trim()) return;
    dispatch({ type: 'SET_BUSINESS_INFO', payload: { businessName, businessDescription } });
    dispatch({ type: 'START_ANIMATION' });
  };

  if (step !== 'input' && step !== 'animating') return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
      style={{
        background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 52%, #24243e 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.45s ease',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* ── Step 1: Input form ── */}
      {step === 'input' && (
        <div className="w-full flex flex-col gap-5">
          <div className="text-center">
            <div className="text-5xl mb-3 animate-bounce">🌟</div>
            <h1 className="text-white text-2xl font-bold leading-snug">
              Build your site in
              <br />
              <span className="text-violet-300">3 seconds flat.</span>
            </h1>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              Tell us about your business — we'll handle the rest.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-gray-400 text-[10px] font-semibold mb-1.5 uppercase tracking-widest">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Paws & Suds Mobile Grooming"
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.7)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-[10px] font-semibold mb-1.5 uppercase tracking-widest">
                What do you do?
              </label>
              <input
                type="text"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="e.g. Mobile dog washing"
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.7)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!businessName.trim()}
            className="relative w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
              boxShadow: '0 0 30px rgba(124,58,237,0.45), 0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              ✨ Generate My App
            </span>
          </button>

          <p className="text-gray-500 text-xs text-center">
            Free forever for your first site. No card required.
          </p>
        </div>
      )}

      {/* ── Step 2: Building animation ── */}
      {step === 'animating' && (
        <div className="w-full flex flex-col items-center gap-7">
          <div className="text-center">
            <div className="text-6xl mb-4" style={{ animation: 'bounce 1s ease infinite' }}>
              🐶
            </div>
            <h2 className="text-white text-xl font-bold">Building your site...</h2>
            <p className="text-gray-400 text-sm mt-1">Just a moment of magic ✨</p>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
                  boxShadow: '0 0 12px rgba(124,58,237,0.6)',
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
            <p className="text-gray-400 text-xs text-center mt-3">{stepLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}
