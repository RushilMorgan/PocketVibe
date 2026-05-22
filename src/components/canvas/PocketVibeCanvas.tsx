import type { AppConfig } from '../../types';
import BlockRenderer from './BlockRenderer';

interface PocketVibeCanvasProps {
  appConfig: AppConfig;
  simulatePartner: boolean;
  shimmeringBlockId: string | null;
  onInteract: (blockId: string, itemId?: string) => void;
}

export default function PocketVibeCanvas({
  appConfig,
  simulatePartner,
  shimmeringBlockId,
  onInteract,
}: PocketVibeCanvasProps) {
  const isMinimal = appConfig.styleSlider > 60;
  const isPlayful = appConfig.styleSlider < 40;
  
  const cardRadius = Math.round(28 - (appConfig.styleSlider / 100) * 24);
  const accent = appConfig.accentColor;

  const dynamicStyles = {
    '--theme-accent': accent,
    '--theme-bg': isMinimal ? '#f9fafb' : '#ffffff',
    '--theme-surface': isMinimal ? '#ffffff' : `${accent}08`,
    '--theme-surface-hover': isMinimal ? '#f3f4f6' : `${accent}15`,
    '--theme-text': isMinimal ? '#111827' : '#1f2937',
    '--theme-text-muted': isMinimal ? '#9ca3af' : '#6b7280',
    '--theme-radius': `${cardRadius}px`,
    '--theme-border': isMinimal ? '1px solid #e5e7eb' : '1px solid transparent',
    '--theme-shadow': isMinimal ? '0 1px 3px rgba(0,0,0,0.05)' : `0 4px 12px ${accent}15`,
    '--theme-font-header': isPlayful ? '"Nunito", sans-serif' : 'system-ui, sans-serif',
  } as React.CSSProperties;
  
  return (
    <div 
      className="canvas-scroll absolute inset-0 overflow-y-auto p-4 bg-theme-bg transition-colors duration-400"
      style={{ ...dynamicStyles, paddingBottom: '64dvh' }}
    >
      {shimmeringBlockId === 'canvas-root' && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-sweep 1s ease-in-out both',
          }}
        />
      )}
      
      {appConfig.blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full opacity-40">
          <p className="text-4xl mb-4">🪄</p>
          <p className="font-bold text-sm text-center px-8">Your generative canvas is empty. Tell your AI companion what micro-app to build.</p>
        </div>
      )}

      {appConfig.blocks.map((block, index) => (
        <div
          key={block.id}
          className="relative mb-3"
          style={{ filter: `drop-shadow(0 8px 28px ${accent}1a) drop-shadow(0 2px 8px rgba(0,0,0,0.05))` }}
        >
          {shimmeringBlockId === block.id && (
            <div
              className="absolute inset-0 z-10 pointer-events-none rounded-xl"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-sweep 1s ease-in-out both',
              }}
            />
          )}

          {simulatePartner && block.type === 'interactive_list' && index === 1 && (
            <div className="absolute -top-2 left-2 z-20 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm pointer-events-none">
              ⚡ Partner is viewing...
            </div>
          )}
          
          <BlockRenderer block={block} appConfig={appConfig} onInteract={onInteract} />
        </div>
      ))}
    </div>
  );
}