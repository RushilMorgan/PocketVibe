import { useState } from 'react';
import { SHAPE_QUESTIONS, composeIdeaDescription, type ShapeQuestion } from '../lib/ideaShape';
import { MicButton } from './shared/MicButton';

interface IdeaShapeGuideProps {
  /** Called with the stitched description — lands in the editable textarea. */
  onDone: (description: string) => void;
  onBack: () => void;
}

/**
 * "Help me shape it": Toolie asks three plain questions, one at a time, and
 * composes the idea description for users who freeze at a blank text box.
 * Answers can be spoken (mic) or typed; two of three are skippable.
 */
export function IdeaShapeGuide({ onDone, onBack }: IdeaShapeGuideProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<ShapeQuestion['id'], string>>>({});
  const [draft, setDraft] = useState('');

  const q = SHAPE_QUESTIONS[index];
  const isLast = index === SHAPE_QUESTIONS.length - 1;
  const canNext = q.optional || draft.trim().length > 0;

  function advance(answer: string) {
    const next = { ...answers, [q.id]: answer.trim() };
    setAnswers(next);
    if (isLast) {
      onDone(composeIdeaDescription(next));
      return;
    }
    setIndex(i => i + 1);
    setDraft('');
  }

  return (
    <>
      <div className="px-5 pb-3 pt-2 flex-shrink-0">
        <button onClick={onBack} className="text-xs text-white/40 mb-2 active:text-white/60">← Back</button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🤝</span>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">
            Question {index + 1} of {SHAPE_QUESTIONS.length}
          </p>
        </div>
        <h3 className="text-lg font-bold text-white leading-tight">{q.question}</h3>
        <p className="text-xs text-white/45 mt-0.5">{q.hint}</p>
      </div>

      <div className="overflow-y-auto px-5 pb-2 min-h-0">
        <div className="flex items-end gap-2">
          <textarea
            data-testid="idea-guide-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            maxLength={200}
            autoFocus
            placeholder={q.placeholder}
            className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <MicButton value={draft} onChange={setDraft} testId="idea-guide-mic" />
        </div>
      </div>

      <div className="px-5 pt-3 pb-6 flex-shrink-0 flex items-center gap-2">
        {q.optional && (
          <button
            data-testid="idea-guide-skip"
            onClick={() => advance('')}
            className="px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-white/60 active:bg-white/10"
          >
            Skip
          </button>
        )}
        <button
          data-testid="idea-guide-next"
          onClick={() => advance(draft)}
          disabled={!canNext}
          className="flex-1 py-3.5 rounded-2xl bg-violet-500 text-white text-sm font-black active:bg-violet-600 disabled:opacity-40 transition-colors"
        >
          {isLast ? '✨ Put it together' : 'Next →'}
        </button>
      </div>
    </>
  );
}
