import { useState, useRef, useEffect } from 'react';
import type { AIArchetype } from '../../types';

const ARCHETYPES: AIArchetype[] = [
  { id: 'lex', name: 'Lex', tagline: 'Minimalist Architect', description: 'Clean layout generative AI.', emoji: '◻️', accentColor: '#1a1a1a' },
  { id: 'ziggy', name: 'Ziggy', tagline: 'Indie Disruptor', description: 'Bold colors, hyper expressive apps.', emoji: '⚡', accentColor: '#f43f5e' },
  { id: 'nova', name: 'Nova', tagline: 'App Strategist', description: 'Data-driven optimized layout generation.', emoji: '🔭', accentColor: '#0ea5e9' },
];

function ArchetypeOnboarding({ companion, onSelectArchetype, onSetCustomName, onConfirm }: any) {
  return (
    <div className="flex flex-col h-full px-4 pt-1 pb-4 gap-2.5">
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Choose Builder AI</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none' }}>
        {ARCHETYPES.map((a) => {
          const selected = companion.archetype?.id === a.id;
          return (
            <button
              key={a.id} onClick={() => onSelectArchetype(a)}
              className="shrink-0 flex flex-col items-center text-center p-2.5 rounded-2xl transition-all active:scale-95"
              style={{ width: '100px', backgroundColor: selected ? `${a.accentColor}18` : 'rgba(0,0,0,0.04)', border: selected ? `2px solid ${a.accentColor}` : '2px solid transparent', outline: 'none' }}
            >
              <span className="text-2xl leading-none mb-1">{a.emoji}</span>
              <span className="text-xs font-black text-gray-800 leading-tight">{a.name}</span>
              <span className="text-[9px] font-bold mt-0.5 leading-tight" style={{ color: a.accentColor }}>{a.tagline}</span>
            </button>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Custom name (optional)"
        value={companion.customName}
        onChange={(e) => onSetCustomName(e.target.value)}
        className="w-full text-sm px-4 py-2.5 rounded-full bg-black/5 border border-black/10 focus:outline-none text-gray-800 placeholder-gray-400"
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
  { label: '🚀 Packing list',      prompt: 'Construct a packing list: passport, charger, clothes, camera' },
  { label: '📈 Finance counter',   prompt: 'Generate a finance metrics counter with budget analytics'     },
  { label: '🌙 Cyberpunk theme',   prompt: 'Cycle to a dark cyberpunk layout'                            },
  { label: '🏋️ Gym tracker',       prompt: 'Build a gym tracker: morning run, core circuit, yoga session' },
  { label: '✅ Task checklist',     prompt: 'Create a task checklist: review PR, write docs, ship feature' },
  { label: '🎨 Shuffle palette',   prompt: 'Shuffle to the next palette color'                           },
];

function CompanionChat({ companion, appConfig, onPrompt, onSliderChange, onFocusChange }: any) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const arc = companion.archetype!;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [companion.messages]);

  function handleSend() {
    if (!inputText.trim()) return;
    onPrompt(inputText.trim());
    setInputText('');
    onFocusChange?.(false);
  }

  return (
    <div className="relative h-full flex flex-col justify-between overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${appConfig.accentColor}18` }}
      >
        <span className="text-lg leading-none">{arc.emoji}</span>
        <div>
          <span className="text-xs font-black" style={{ color: appConfig.accentColor }}>{companion.customName.trim() || arc.name}</span>
          <span className="text-[10px] ml-1.5" style={{ color: `${appConfig.accentColor}80` }}>{arc.tagline}</span>
        </div>
      </div>

      <div
        className="flex-1 w-full overflow-y-auto px-4 py-2 flex flex-col gap-2 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {companion.messages.map((msg: any) => (
          <div key={msg.id} className={`flex mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[11px] leading-snug px-2.5 py-1.5 rounded-2xl max-w-[80%]" style={{ backgroundColor: msg.role === 'user' ? arc.accentColor : '#f3f4f6', color: msg.role === 'user' ? '#fff' : '#374151', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px' }}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      <div
        className="px-4 pb-4 pt-2 flex flex-col gap-2 shrink-0"
        style={{ borderTop: `1px solid ${appConfig.accentColor}12` }}
      >
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => !inputText && onFocusChange?.(false)}
            placeholder="E.g. Generate a fitness log..."
            className="flex-1 text-[11px] px-4 py-2.5 rounded-full bg-black/5 border border-black/10 focus:outline-none text-gray-800 placeholder-gray-400"
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
                backgroundColor: `${appConfig.accentColor}12`,
                color: appConfig.accentColor,
                border: `1px solid ${appConfig.accentColor}20`,
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

export default function CompanionSheet({ companion, appConfig, onSelectArchetype, onSetCustomName, onConfirm, onPrompt, onSliderChange }: any) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = companion.archetype?.accentColor ?? '#7c3aed';
  const isChat = companion.phase === 'chat';
  const heightClass = expanded && isChat ? 'h-[50dvh]' : 'h-[28dvh]';
  return (
    <div
      className={`absolute bottom-4 left-4 right-4 z-10 max-h-[85dvh] ${heightClass} flex flex-col overflow-hidden bg-white/40 backdrop-blur-xl border border-white/30 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all duration-500`}
      style={{ transition: 'height 500ms cubic-bezier(0.25, 1, 0.5, 1)' }}
    >
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: `${accentColor}50` }} />
      </div>
      {companion.phase === 'onboarding' ? (
        <ArchetypeOnboarding companion={companion} onSelectArchetype={onSelectArchetype} onSetCustomName={onSetCustomName} onConfirm={onConfirm} />
      ) : (
        <CompanionChat companion={companion} appConfig={appConfig} onPrompt={onPrompt} onSliderChange={onSliderChange} onFocusChange={setExpanded} />
      )}
    </div>
  );
}