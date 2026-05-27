import React from 'react';
import type { GuidanceState } from '../lib/guidance';

interface SmartGuidanceProps {
  guidance: GuidanceState;
  onAction: (actionId: string) => void;
}

export function SmartGuidance({ guidance, onAction }: SmartGuidanceProps) {
  const { setupTitle, setupSteps, suggestions, quickActions, isSetupComplete } = guidance;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Quick actions: horizontal scroll row ──────────────────────────── */}
      {quickActions.length > 0 && (
        <div
          data-testid="quick-actions"
          className="flex gap-2 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {quickActions.map(action => (
            <button
              key={action.id}
              data-testid={`quick-action-${action.id}`}
              onClick={() => onAction(action.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap
                ${action.variant === 'primary'
                  ? 'bg-yellow-500 text-white active:bg-yellow-600'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                }`}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Setup checklist: shown until all steps done ───────────────────── */}
      {!isSetupComplete && setupSteps.length > 0 && (
        <div
          data-testid="setup-checklist"
          className="bg-amber-50 border border-amber-100 rounded-2xl p-4"
        >
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
            {setupTitle}
          </p>
          <div className="flex flex-col gap-2.5">
            {setupSteps.map(step => (
              <div key={step.id} className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                    ${step.done
                      ? 'bg-green-500 text-white'
                      : 'border-2 border-amber-200 bg-white'
                    }`}
                >
                  {step.done && '✓'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${step.done ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                    {step.label}
                  </span>
                  {step.detail && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Smart suggestions: top contextual hints ───────────────────────── */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.slice(0, 3).map(s => (
            <div
              key={s.id}
              data-testid={`suggestion-${s.id}`}
              onClick={s.actionId ? () => onAction(s.actionId!) : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium
                ${s.variant === 'warning'
                  ? 'bg-red-50 border border-red-100 text-red-700'
                  : s.variant === 'info'
                    ? 'bg-blue-50 border border-blue-100 text-blue-700'
                    : s.actionId
                      ? 'bg-gray-50 border border-gray-100 text-gray-700 cursor-pointer active:bg-gray-100'
                      : 'bg-gray-50 border border-gray-100 text-gray-600'
                }`}
            >
              <span className="flex-shrink-0">{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              {s.actionId && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-40">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
