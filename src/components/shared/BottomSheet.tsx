import React from 'react';

/**
 * The app's standard Velix bottom sheet (light/frosted, rounded top, drag
 * handle). One implementation instead of a copy per intake sheet — change the
 * look here and every sheet follows. Renders nothing when `open` is false.
 */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  testId?: string;
  /** Kept for API compatibility; the Velix sheet is monochrome (no coloured border). */
  accent?: 'violet' | 'rose';
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, testId, children }: BottomSheetProps) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        data-testid={testId}
        className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[88%] z-10"
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(22,21,15,0.15)' }} />
        </div>
        {children}
      </div>
    </div>
  );
}
