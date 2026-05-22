import { useState, useRef, useEffect } from 'react';
import type { AIArchetype } from '../../types';

const ARCHETYPES: AIArchetype[] = [
  { id: 'lex', name: 'Lex', tagline: 'Minimalist Architect', description: 'Clean layout generative AI.', emoji: '◻️', accentColor: '#1a1a1a' },
  { id: 'ziggy', name: 'Ziggy', tagline: 'Indie Disruptor', description: 'Bold colors, hyper expressive apps.', emoji: '⚡', accentColor: '#f43f5e' },
  { id: 'nova', name: 'Nova', tagline: 'App Strategist', description: 'Data-driven optimized layout generation.', emoji: '🔭', accentColor: '#0ea5e9' },
];

function ArchetypeOnboarding({ companion, onSelectArchetype, onSetCustomName, onConfirm }: any) {
  return (
    <div className="flex flex-col h-full px-3 pt-1 pb-3 gap-2">
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Choose Builder AI</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none' }}>
        {ARCHETYPES.map((a) => {
          const selected = companion.archetype?.id === a.id;
          return (
            <button
              key={a.id} onClick={() => onSelectArchetype(a)}
              className="shrink-0 flex flex-col items-center text-center p-2.5 rounded-2xl transition-all active:scale-95"
              style={{ width: '100px', backgroundColor: selected ? `${a.accentColor}18` : '#f9fafb', border: selected ? `2px solid ${a.accentColor}` : '2px solid transparent', outline: 'none' }}
            >
              <span className="text-2xl leading-none mb-1">{a.emoji}</span>
              <span className="text-xs font-black text-gray-800 leading-tight">{a.name}</span>
              <span className="text-[9px] font-bold mt-0.5 leading-tight" style={{ color: a.accentColor }}>{a.tagline}</span>
            </button>
          );
        })}
      </div>
      <input type="text" placeholder="Custom name (optional)" value={companion.customName} onChange={(e) => onSetCustomName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-violet-400 text-gray-800" />
      <button onClick={onConfirm} disabled={!companion.archetype} className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40" style={{ backgroundColor: companion.archetype?.accentColor ?? '#7c3aed' }}>
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid #f0f0f5' }}>
        <span className="text-lg leading-none">{arc.emoji}</span>
        <div>
          <span className="text-xs font-black text-gray-800">{companion.customName.trim() || arc.name}</span>
          <span className="text-[10px] text-gray-400 ml-1.5">{arc.tagline}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5 min-h-0">
        {companion.messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[11px] leading-snug px-2.5 py-1.5 rounded-2xl max-w-[80%]" style={{ backgroundColor: msg.role === 'user' ? arc.accentColor : '#f3f4f6', color: msg.role === 'user' ? '#fff' : '#374151', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px' }}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 pb-3 pt-1.5 flex flex-col gap-1.5 shrink-0" style={{ borderTop: '1px solid #f0f0f5' }}>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => !inputText && onFocusChange?.(false)}
            placeholder="E.g. Generate a fitness log..."
            className="flex-1 text-[11px] px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-violet-300 text-gray-800"
          />
          <button onClick={handleSend} className="px-3 py-2 rounded-xl text-white text-[11px] font-bold active:scale-95 transition-transform" style={{ backgroundColor: arc.accentColor }}>↑</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-400 font-medium shrink-0">Playful</span>
          <input type="range" min={0} max={100} value={appConfig.styleSlider} onChange={(e) => onSliderChange(Number(e.target.value))} className="flex-1 h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: arc.accentColor }} />
          <span className="text-[9px] text-gray-400 font-medium shrink-0">Minimal</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {INTENT_PILLS.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => onPrompt(prompt)}
              className="shrink-0 text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-all active:scale-95 whitespace-nowrap"
              style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
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
  const flexValue = expanded && companion.phase === 'chat' ? '50' : '30';
  return (
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={{
        flex: flexValue,
        borderTop: `2px solid ${accentColor}30`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex justify-center pt-2 pb-0 shrink-0"><div className="w-8 h-1 rounded-full bg-gray-200" /></div>
      {companion.phase === 'onboarding' ? (
        <ArchetypeOnboarding companion={companion} onSelectArchetype={onSelectArchetype} onSetCustomName={onSetCustomName} onConfirm={onConfirm} />
      ) : (
        <CompanionChat companion={companion} appConfig={appConfig} onPrompt={onPrompt} onSliderChange={onSliderChange} onFocusChange={setExpanded} />
      )}
    </div>
  );
}