import { useState, useRef, useEffect } from 'react';
import type { AIArchetype } from '../../types';

const ARCHETYPES: AIArchetype[] = [
  { id: 'lex',   name: 'Lex',   tagline: 'Minimalist Architect', description: 'Clean layout generative AI.',         emoji: '◻️', accentColor: '#1a1a1a' },
  { id: 'ziggy', name: 'Ziggy', tagline: 'Indie Disruptor',      description: 'Bold colors, hyper expressive apps.', emoji: '⚡', accentColor: '#f43f5e' },
  { id: 'nova',  name: 'Nova',  tagline: 'App Strategist',       description: 'Data-driven optimized layout.',        emoji: '🔭', accentColor: '#0ea5e9' },
];

function ArchetypeOnboarding({ companion, onSelectArchetype, onSetCustomName, onConfirm }: any) {
  return (
    <div className="flex flex-col flex-1 px-4 pt-2 pb-4 gap-3 overflow-y-auto">
      <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Choose Builder AI</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none' }}>
        {ARCHETYPES.map((a) => {
          const selected = companion.archetype?.id === a.id;
          return (
            <button
              key={a.id} onClick={() => onSelectArchetype(a)}
              className="shrink-0 flex flex-col items-center text-center p-2 rounded-2xl transition-all active:scale-95"
              style={{ width: '105px', backgroundColor: selected ? `${a.accentColor}18` : 'rgba(255,255,255,0.35)', border: selected ? `2px solid ${a.accentColor}` : '2px solid transparent', outline: 'none' }}
            >
              <span className="text-xl leading-none mb-1">{a.emoji}</span>
              <span className="text-xs font-black text-gray-800 leading-tight">{a.name}</span>
              <span className="text-[8px] font-bold mt-0.5 leading-tight" style={{ color: a.accentColor }}>{a.tagline}</span>
            </button>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Custom name (optional)"
        value={companion.customName}
        onChange={(e) => onSetCustomName(e.target.value)}
        className="w-full text-sm px-4 py-2.5 rounded-full bg-white/40 border border-white/40 focus:outline-none text-gray-800 placeholder-gray-400"
        style={{ caretColor: companion.archetype?.accentColor ?? '#7c3aed' }}
      />
      <button
        onClick={onConfirm}
        disabled={!companion.archetype}
        className="w-full py-2.5 rounded-full text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
        style={{ backgroundColor: companion.archetype?.accentColor ?? '#7c3aed' }}
      >
        {companion.archetype ? `Initialize ${companion.customName.trim() || companion.archetype.name} Engine →` : 'Select a companion'}
      </button>
    </div>
  );
}

const INTENT_PILLS: { label: string; prompt: string }[] = [
  { label: '🚀 Packing list',    prompt: 'Construct a packing list: passport, charger, clothes, camera' },
  { label: '📈 Finance counter', prompt: 'Generate a finance metrics counter with budget analytics'     },
  { label: '🌙 Cyberpunk theme', prompt: 'Cycle to a dark cyberpunk layout'                            },
  { label: '🏋️ Gym tracker',     prompt: 'Build a gym tracker: morning run, core circuit, yoga session' },
  { label: '✅ Task checklist',   prompt: 'Create a task checklist: review PR, write docs, ship feature' },
  { label: '🎨 Shuffle palette', prompt: 'Shuffle to the next palette color'                           },
];

function CompanionChat({ companion, appConfig, onPrompt, onSliderChange }: any) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const arc = companion.archetype!;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [companion.messages]);

  function handleSend() {
    if (!inputText.trim()) return;
    onPrompt(inputText.trim());
    setInputText('');
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Message history — grows organically, never clips text */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 w-full max-h-[70dvh] flex flex-col gap-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {companion.messages.map((msg: any) => (
          <div key={msg.id} className={`flex mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <span
              className="text-[12px] leading-snug px-3 py-2 max-w-[80%]"
              style={{
                backgroundColor: msg.role === 'user' ? arc.accentColor : 'rgba(255,255,255,0.5)',
                color: msg.role === 'user' ? '#fff' : '#1f2937',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      {/* Input + controls — pinned to bottom, clear of safe area */}
      <div
        className="px-4 pt-2 flex flex-col gap-2 shrink-0"
        style={{
          borderTop: `1px solid ${appConfig.accentColor}25`,
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 12px), 16px)',
        }}
      >
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="E.g. Generate a fitness log..."
            className="flex-1 text-[12px] px-4 py-2.5 rounded-full bg-white/40 border border-white/40 focus:outline-none text-gray-800 placeholder-gray-400"
            style={{ caretColor: appConfig.accentColor }}
          />
          <button
            onClick={handleSend}
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold active:scale-95 transition-all"
            style={{ backgroundColor: appConfig.accentColor }}
          >↑</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-medium shrink-0" style={{ color: `${appConfig.accentColor}90` }}>Playful</span>
          <input type="range" min={0} max={100} value={appConfig.styleSlider} onChange={(e) => onSliderChange(Number(e.target.value))} className="flex-1 h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: appConfig.accentColor }} />
          <span className="text-[9px] font-medium shrink-0" style={{ color: `${appConfig.accentColor}90` }}>Minimal</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {INTENT_PILLS.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => onPrompt(prompt)}
              className="shrink-0 text-[10px] font-semibold py-1.5 px-3 rounded-full transition-all active:scale-95 whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(255,255,255,0.3)',
                color: appConfig.accentColor,
                border: `1px solid ${appConfig.accentColor}30`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CompanionSheet({ companion, appConfig, isOpen, onOpenChange, onSelectArchetype, onSetCustomName, onConfirm, onPrompt, onSliderChange }: any) {
  const accentColor = companion.archetype?.accentColor ?? '#7c3aed';
  const displayEmoji = companion.archetype?.emoji ?? '✨';
  const displayName = companion.customName?.trim() || (companion.archetype?.name ?? 'AI');

  return (
    <>
      {/* ── Floating action bubble — always on top of the canvas ─── */}
      <button
        onClick={() => onOpenChange(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl z-50 cursor-pointer active:scale-90 transition-transform animate-bounce"
        style={{ backgroundColor: accentColor }}
        aria-label="Open companion chat"
      >
        <span className="text-2xl leading-none select-none">{displayEmoji}</span>
      </button>

      {/* ── Full-screen glass overlay ─────────────────────────────── */}
      {isOpen && (
        <div className="absolute inset-0 w-full h-full z-40 bg-white/20 backdrop-blur-2xl flex flex-col overflow-hidden animate-slide-up">

          {/* Header bar */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ borderBottom: `1px solid ${accentColor}25` }}
          >
            <span className="text-xl leading-none select-none">{displayEmoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black" style={{ color: accentColor }}>{displayName}</span>
              {companion.archetype && (
                <span className="text-[10px] ml-2" style={{ color: `${accentColor}80` }}>
                  {companion.archetype.tagline}
                </span>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 bg-black/10 text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Content area */}
          {companion.phase === 'onboarding' ? (
            <ArchetypeOnboarding
              companion={companion}
              onSelectArchetype={onSelectArchetype}
              onSetCustomName={onSetCustomName}
              onConfirm={onConfirm}
            />
          ) : (
            <CompanionChat
              companion={companion}
              appConfig={appConfig}
              onPrompt={onPrompt}
              onSliderChange={onSliderChange}
            />
          )}
        </div>
      )}
    </>
  );
}