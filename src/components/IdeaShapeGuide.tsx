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
        <button onClick={onBack} className="text-xs tp-ink-3 mb-2 active:opacity-60">← Back</button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🤝</span>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] tp-ink-3">
            Question {index + 1} of {SHAPE_QUESTIONS.length}
          </p>
        </div>
        <h3 className="text-lg font-extrabold tp-ink tracking-tight leading-tight">{q.question}</h3>
        <p className="text-xs tp-ink-3 mt-0.5">{q.hint}</p>
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
            className="tp-input flex-1 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: 'rgba(22,21,15,0.18)' }}
          />
          <MicButton value={draft} onChange={setDraft} testId="idea-guide-mic" />
        </div>
      </div>

      <div className="px-5 pt-3 pb-6 flex-shrink-0 flex items-center gap-2">
        {q.optional && (
          <button
            data-testid="idea-guide-skip"
            onClick={() => advance('')}
            className="tp-glass tp-ink px-4 py-3.5 rounded-2xl text-sm font-semibold active:scale-95 transition-transform"
          >
            Skip
          </button>
        )}
        <button
          data-testid="idea-guide-next"
          onClick={() => advance(draft)}
          disabled={!canNext}
          className="tp-btn-dark flex-1 py-3.5 rounded-2xl text-sm font-black active:scale-[0.99] disabled:opacity-40 transition-transform"
        >
          {isLast ? '✨ Put it together' : 'Next →'}
        </button>
      </div>
    </>
  );
}
