import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper over the Web Speech API for tap-to-talk input. Feature-detects
 * SpeechRecognition (Chrome/Edge/Safari prefix it as webkitSpeechRecognition);
 * on unsupported browsers `supported` is false and the mic UI simply hides.
 */

// TS's lib.dom has no SpeechRecognition types — declare the minimal surface used.
interface SpeechAlternativeLike {
  transcript: string;
}
interface SpeechResultLike {
  isFinal: boolean;
  0: SpeechAlternativeLike;
}
interface SpeechResultEventLike {
  results: ArrayLike<SpeechResultLike>;
}
interface SpeechErrorEventLike {
  error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechErrorEventLike) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

export interface UseSpeechInputOptions {
  /**
   * Called with the full transcript so far on every recognition update —
   * interim results stream in live, then a final pass lands when the user
   * stops speaking.
   */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** BCP-47 language tag; defaults to the browser language. */
  lang?: string;
}

export function useSpeechInput({ onTranscript, lang }: UseSpeechInputOptions) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    setError(null);

    const recognition = new Ctor();
    recognition.lang = lang
      ?? ((typeof navigator !== 'undefined' && navigator.language) || 'en-ZA');
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let text = '';
      let allFinal = true;
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        text += result[0]?.transcript ?? '';
        if (!result.isFinal) allFinal = false;
      }
      onTranscriptRef.current(text.trim(), allFinal);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = (e) => {
      // 'no-speech'/'aborted' are normal endings; everything else is surfaced
      const code = e.error ?? 'unknown';
      if (code !== 'no-speech' && code !== 'aborted') setError(code);
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [lang]);

  // Abort any in-flight recognition when the consumer unmounts
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
