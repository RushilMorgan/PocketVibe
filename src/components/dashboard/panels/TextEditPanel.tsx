import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface TextEditPanelProps {
  field: 'headline' | 'subheadline';
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}

// ── AI-style text transformations ────────────────────────────────────────────

function punchier(text: string): string {
  const clean = text.replace(/[.!?]+$/, '').trim();
  return clean + '! 🔥';
}

function professional(text: string): string {
  const clean = text
    .replace(/[\u{1F300}-\u{1FFFF}!🔥]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clean.endsWith('.') ? clean : clean + '.';
}

function shorten(text: string): string {
  const firstClause = text.split(/[,—–!]/)[0].trim();
  if (firstClause.length > 15 && firstClause.length < text.length * 0.85) return firstClause;
  const words = text.split(' ');
  return words.slice(0, Math.max(5, Math.floor(words.length * 0.6))).join(' ');
}

const SUGGESTIONS = [
  { label: 'Punchier 🔥', fn: punchier },
  { label: 'Professional 👔', fn: professional },
  { label: 'Shorten ✂️', fn: shorten },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TextEditPanel({ field, value, onChange, onDone }: TextEditPanelProps) {
  const [draft, setDraft] = useState(value);

  // Re-sync when switching between headline / subheadline
  useEffect(() => {
    setDraft(value);
  }, [field, value]);

  const commit = (newVal: string) => {
    setDraft(newVal);
    onChange(newVal);
  };

  return (
    <div className="px-4 pt-2 pb-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {field === 'headline' ? 'Edit Headline' : 'Edit Subheadline'}
        </p>
        <button
          onClick={onDone}
          className="flex items-center gap-1 text-xs font-bold text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
        >
          <Check className="w-3 h-3" />
          Done
        </button>
      </div>

      <textarea
        value={draft}
        onChange={(e) => commit(e.target.value)}
        rows={3}
        className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-violet-400 transition-all leading-snug"
        autoFocus
      />

      <div className="flex gap-1.5 mt-2">
        {SUGGESTIONS.map(({ label, fn }) => (
          <button
            key={label}
            onClick={() => commit(fn(draft))}
            className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-700 active:scale-95 transition-all truncate px-1"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
