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
          className="tp-card rounded-2xl px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="tp-btn-dark flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold flex-shrink-0">
              {next.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] tp-ink-3">
                ✦ Toolie suggests
              </p>
              <p className="text-sm font-semibold tp-ink">{next.label}</p>
            </div>
            {next.actionId && (
              <button
                data-testid="next-best-action-button"
                onClick={() => onAction(next.actionId!)}
                className="tp-btn-dark rounded-full px-3 py-2 text-xs font-semibold active:scale-95 transition-transform flex-shrink-0"
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
                  ? 'tp-btn-dark active:scale-95'
                  : 'tp-glass tp-ink active:scale-95'
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
