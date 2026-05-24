import React from 'react';
import type { Creation, CreationContent } from '../../types';
import { ChecklistRenderer } from './ChecklistRenderer';
import { HabitTrackerRenderer } from './HabitTrackerRenderer';
import { BudgetCalculatorRenderer } from './BudgetCalculatorRenderer';
import { SavingsTrackerRenderer } from './SavingsTrackerRenderer';
import { LandingPageRenderer } from './LandingPageRenderer';

interface TemplateRendererProps {
  creation: Creation;
  onContentChange: (id: string, content: CreationContent) => void;
}

export function TemplateRenderer({ creation, onContentChange }: TemplateRendererProps) {
  const { content } = creation;

  function handleChange(updated: CreationContent) {
    onContentChange(creation.id, updated);
  }

  // ── Dev-only type badge ──────────────────────────────────────────────────
  const devBadge = import.meta.env.DEV ? (
    <div
      style={{ position: 'absolute', top: 4, right: 8, zIndex: 50 }}
      className="text-[10px] font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 pointer-events-none select-none"
      aria-hidden="true"
    >
      {content.type}
    </div>
  ) : null;

  function renderContent() {
    switch (content.type) {
      case 'checklist':
        return <ChecklistRenderer content={content} onChange={handleChange} />;

      case 'habit_tracker':
        return <HabitTrackerRenderer content={content} onChange={handleChange} />;

      case 'budget_calculator':
        return <BudgetCalculatorRenderer content={content} onChange={handleChange} />;

      case 'savings_tracker':
        return <SavingsTrackerRenderer content={content} onChange={handleChange} />;

      case 'landing_page':
        return <LandingPageRenderer content={content} />;

      case 'event_planner':
      case 'meal_planner':
      case 'workout_tracker':
      case 'survey_form':
      case 'task_planner': {
        // Generic JSON viewer for types without a dedicated renderer yet
        return (
          <div className="p-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-sm text-gray-500 mb-3">
                {creation.summary || creation.description}
              </p>
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600 select-none">View raw data</summary>
                <pre className="mt-2 overflow-x-auto text-xs bg-gray-50 rounded-xl p-3 leading-relaxed">
                  {JSON.stringify(content, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        );
      }

      case 'generative_html':
        // generative_html is disabled — the AI should not produce this type.
        // If an old saved creation has this type, show a helpful fallback instead of raw HTML.
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
            <span className="text-4xl">🚧</span>
            <p className="text-sm text-gray-500">
              This creation was made with an older format that's no longer supported.
              Ask AI to rebuild it as a new creation.
            </p>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
            <span className="text-4xl">🤔</span>
            <p className="text-sm text-gray-500">
              This type of creation isn't supported in this version yet.
              Ask AI to improve it or make it a different type.
            </p>
          </div>
        );
    }
  }

  return (
    <div className="relative">
      {devBadge}
      {renderContent()}
    </div>
  );
}
