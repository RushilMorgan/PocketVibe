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
  
  return (
    <div 
      className="canvas-scroll relative"
      style={{ 
        flex: '63', overflowY: 'auto', padding: '16px', 
        backgroundColor: isMinimal ? '#f9fafb' : '#ffffff',
        transition: 'background-color 0.4s ease'
      }}
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
        <div key={block.id} className="relative">
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