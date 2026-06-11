import { useState } from 'react';

interface CreationSummaryBannerProps {
  text: string;
}

/**
 * Toolie's one-off summary for a freshly built creation. Mobile screen space
 * is precious, so it opens clamped to a single line — tap to read the rest,
 * or dismiss it entirely. Key this by creation id so state resets per tool.
 */
export function CreationSummaryBanner({ text }: CreationSummaryBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      data-testid="creation-summary-banner"
      className="mx-4 mt-3 px-3.5 py-2 bg-gray-50 rounded-xl flex items-start gap-2 flex-shrink-0"
    >
      <button
        data-testid="summary-expand"
        onClick={() => setExpanded(e => !e)}
        className="flex-1 min-w-0 text-left"
        aria-expanded={expanded}
      >
        <p className={`text-[13px] text-gray-600 leading-snug ${expanded ? '' : 'line-clamp-1'}`}>
          {text}
        </p>
        {!expanded && <span className="text-[10px] font-semibold text-gray-400">more</span>}
      </button>
      <button
        data-testid="summary-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss summary"
        className="flex-shrink-0 w-5 h-5 rounded-full text-gray-300 hover:text-gray-500 text-sm font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
}
