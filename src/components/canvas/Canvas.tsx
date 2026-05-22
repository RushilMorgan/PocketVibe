import { useEffect, useState } from 'react';
import type { SiteConfig, OnboardingStep, SiteBuilderAction } from '../../types';
import LandingPage from './LandingPage';

interface CanvasProps {
  siteConfig: SiteConfig;
  onboardingStep: OnboardingStep;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export default function Canvas({ siteConfig, onboardingStep, dispatch }: CanvasProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (onboardingStep === 'interactive') {
      // Brief delay so the overlay fade finishes before sections animate in
      const t = setTimeout(() => setRevealed(true), 150);
      return () => clearTimeout(t);
    }
  }, [onboardingStep]);

  return (
    <div
      className="canvas-scroll overflow-y-auto overflow-x-hidden"
      style={{ flex: '63' }}
    >
      <LandingPage siteConfig={siteConfig} revealed={revealed} dispatch={dispatch} />
    </div>
  );
}
