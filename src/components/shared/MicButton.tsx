import { useRef } from 'react';
import { useSpeechInput } from '../../hooks/useSpeechInput';

interface MicButtonProps {
  /** Current field value — speech appends after it. */
  value: string;
  onChange: (text: string) => void;
  testId?: string;
}

/**
 * Tap-to-talk mic for any text field (dark-sheet styling). Speech streams in
 * live after whatever was already typed; renders nothing on browsers without
 * SpeechRecognition support.
 */
export function MicButton({ value, onChange, testId = 'mic-btn' }: MicButtonProps) {
  const baseRef = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;

  const speech = useSpeechInput({
    onTranscript: text => {
      const base = baseRef.current;
      onChange(base ? `${base} ${text}` : text);
    },
  });
  if (!speech.supported) return null;

  function toggle() {
    if (speech.listening) {
      speech.stop();
    } else {
      baseRef.current = valueRef.current.trim();
      speech.start();
    }
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={toggle}
      aria-label={speech.listening ? 'Stop listening' : 'Speak instead of typing'}
      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        speech.listening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-white/8 text-white/70 border border-white/10 active:bg-white/15'
      }`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
