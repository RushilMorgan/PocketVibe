import React from 'react';
import type { GuidanceState, QuickActionDef } from '../lib/guidance';

interface SmartGuidanceProps {
  guidance: GuidanceState;
  onAction: (actionId: string) => void;
}

function pickNextAction(guidance: GuidanceState): {
  label: string;
  icon: string;
  actionId?: string;
} | null {
  const topSuggestion = guidance.suggestions[0];
  if (topSuggestion) {
    return {
      label: topSuggestion.label,
      icon: topSuggestion.icon,
      actionId: topSuggestion.actionId,
    };
  }

  const nextStep = guidance.setupSteps.find(step => !step.done);
  if (nextStep) {
    return {
      label: `Next: ${nextStep.label}`,
      icon: '→',
    };
  }

  const primary = guidance.quickActions.find(action => action.variant === 'primary') ?? guidance.quickActions[0];
  if (primary) {
    return {
      label: primary.label,
      icon: primary.icon,
      actionId: primary.id,
    };
  }

  return null;
}

function pickSecondaryActions(guidance: GuidanceState, usedActionId?: string): QuickActionDef[] {
  return guidance.quickActions
    .filter(action => action.id !== usedActionId)
    .slice(0, 2);
}

export function SmartGuidance({ guidance, onAction }: SmartGuidanceProps) {
  const next = pickNextAction(guidance);
  const quickActions = pickSecondaryActions(guidance, next?.actionId);

  if (!next && quickActions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {next && (
        <div
          data-testid="next-best-action"
          className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white flex-shrink-0">
              {next.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400">
                ✦ Toolie suggests
              </p>
              <p className="text-sm font-semibold text-gray-900">{next.label}</p>
            </div>
            {next.actionId && (
              <button
                data-testid="next-best-action-button"
                onClick={() => onAction(next.actionId!)}
                className="rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white active:bg-violet-700 flex-shrink-0"
              >
                Do it
              </button>
            )}
          </div>
        </div>
      )}

      {quickActions.length > 0 && (
        <div data-testid="quick-actions" className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          {quickActions.map(action => (
            <button
              key={action.id}
              data-testid={`quick-action-${action.id}`}
              onClick={() => onAction(action.id)}
              className={`flex-shrink-0 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                action.variant === 'primary'
                  ? 'bg-violet-600 text-white active:bg-violet-700'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
