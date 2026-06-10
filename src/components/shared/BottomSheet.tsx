import React from 'react';

/**
 * The app's standard dark bottom sheet (backdrop, rounded top, drag handle).
 * One implementation instead of a copy per intake/chat sheet — change the look
 * here and every sheet follows. Renders nothing when `open` is false.
 */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  testId?: string;
  /** Top-border accent. Literal class strings — Tailwind needs them static. */
  accent?: 'violet' | 'rose';
  children: React.ReactNode;
}

const ACCENT_BORDER: Record<NonNullable<BottomSheetProps['accent']>, string> = {
  violet: 'border-violet-500/20',
  rose: 'border-rose-500/20',
};

export function BottomSheet({ open, onClose, testId, accent = 'violet', children }: BottomSheetProps) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        data-testid={testId}
        className={`relative bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col max-h-[88%] z-10 border-t ${ACCENT_BORDER[accent]}`}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  );
}
