import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechInput } from '../hooks/useSpeechInput';

// Minimal mock of the Web Speech API surface the hook uses
class MockRecognition {
  static instances: MockRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  started = false;
  constructor() { MockRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}

function installMock() {
  (window as unknown as Record<string, unknown>).SpeechRecognition = MockRecognition;
}
function removeMock() {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  MockRecognition.instances = [];
}

afterEach(removeMock);

describe('useSpeechInput', () => {
  it('reports unsupported when no SpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechInput({ onTranscript: vi.fn() }));
    expect(result.current.supported).toBe(false);
    // start() must be a harmless no-op
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
  });

  it('streams interim and final transcripts while listening', () => {
    installMock();
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ onTranscript }));
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    const rec = MockRecognition.instances[0];
    expect(rec.started).toBe(true);
    expect(rec.interimResults).toBe(true);

    act(() => {
      rec.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'make me a ' }, length: 1 }] });
      rec.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'make me a meal plan' }, length: 1 }] });
    });
    expect(onTranscript).toHaveBeenNthCalledWith(1, 'make me a', false);
    expect(onTranscript).toHaveBeenNthCalledWith(2, 'make me a meal plan', true);

    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
  });

  it('surfaces real errors but treats no-speech as a normal ending', () => {
    installMock();
    const { result } = renderHook(() => useSpeechInput({ onTranscript: vi.fn() }));

    act(() => result.current.start());
    act(() => { MockRecognition.instances[0].onerror?.({ error: 'no-speech' }); });
    expect(result.current.error).toBeNull();
    expect(result.current.listening).toBe(false);

    act(() => result.current.start());
    act(() => { MockRecognition.instances[1].onerror?.({ error: 'not-allowed' }); });
    expect(result.current.error).toBe('not-allowed');
    expect(result.current.listening).toBe(false);
  });
});
