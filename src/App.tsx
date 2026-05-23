import { useState, useEffect, useRef } from 'react';
import AppShell from './components/AppShell';
import PVHeader from './components/PVHeader';
import PocketVibeCanvas from './components/canvas/PocketVibeCanvas';
import CompanionSheet from './components/thumbzone/CompanionSheet';
import { usePocketVibe } from './hooks/usePocketVibe';

export default function App() {
  const { state, dispatch, processPrompt } = usePocketVibe();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerSeq, setBannerSeq] = useState(0);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the ambient banner after 4.5 s
  useEffect(() => {
    if (bannerText) {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setBannerText(null), 4500);
    }
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); };
  }, [bannerText]);

  function handlePrompt(text: string) {
    processPrompt(text, (replyText) => {
      // Let shimmer register for 350 ms, then collapse overlay and surface the banner
      setTimeout(() => {
        setIsSheetOpen(false);
        setBannerText(replyText);
        setBannerSeq((s) => s + 1);
      }, 350);
    });
  }

  // Hide the top bar when the full-screen chat overlay is open in chat phase —
  // the glass material pools edge-to-edge to the device notch
  const hideHeader = isSheetOpen && state.companion.phase === 'chat';

  return (
    <AppShell>
      {!hideHeader && (
        <PVHeader
          simulatePartner={state.simulatePartner}
          currentColor={state.appConfig.accentColor}
          onToggleSimulate={() => dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' })}
          onLoadPreset={(preset) => dispatch({ type: 'LOAD_PRESET', payload: preset })}
        />
      )}

      <div className="relative flex-1 w-full overflow-hidden">
        <PocketVibeCanvas
          appConfig={state.appConfig}
          simulatePartner={state.simulatePartner}
          shimmeringBlockId={state.shimmeringBlockId}
          onInteract={(blockId, itemId) => dispatch({ type: 'INTERACT_BLOCK', payload: { blockId, itemId } })}
        />

        {/* ── Ambient AI notification banner ──────────────────────── */}
        {bannerText && (
          <div
            key={bannerSeq}
            className="absolute top-4 left-4 right-4 mx-auto p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-white/30 text-xs font-bold text-gray-800 shadow-lg z-30 pointer-events-none transition-opacity duration-700 animate-fade-in"
          >
            {bannerText}
          </div>
        )}

        <CompanionSheet
          companion={state.companion}
          appConfig={state.appConfig}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSelectArchetype={(a: any) => dispatch({ type: 'SELECT_ARCHETYPE', payload: a })}
          onSetCustomName={(n: string) => dispatch({ type: 'SET_CUSTOM_NAME', payload: n })}
          onConfirm={() => dispatch({ type: 'CONFIRM_COMPANION' })}
          onPrompt={handlePrompt}
          onSliderChange={(v: number) => dispatch({ type: 'SET_STYLE_SLIDER', payload: v })}
        />
      </div>
    </AppShell>
  );
}