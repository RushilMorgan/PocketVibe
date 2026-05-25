import React from 'react';
import type { Creation, CreationContent } from '../../types';
import { ChecklistRenderer } from './ChecklistRenderer';
import { HabitTrackerRenderer } from './HabitTrackerRenderer';
import { BudgetCalculatorRenderer } from './BudgetCalculatorRenderer';
import { SavingsTrackerRenderer } from './SavingsTrackerRenderer';
import { LandingPageRenderer } from './LandingPageRenderer';
import { EventPlannerRenderer } from './EventPlannerRenderer';
import { MealPlannerRenderer } from './MealPlannerRenderer';
import { WorkoutTrackerRenderer } from './WorkoutTrackerRenderer';
import { TaskPlannerRenderer } from './TaskPlannerRenderer';
import { PriceCalculatorRenderer } from './PriceCalculatorRenderer';

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
        return <LandingPageRenderer content={content} onChange={handleChange} />;

      case 'event_planner':
        return <EventPlannerRenderer content={content} onChange={handleChange} />;

      case 'meal_planner':
        return <MealPlannerRenderer content={content} onChange={handleChange} />;

      case 'workout_tracker':
        return <WorkoutTrackerRenderer content={content} onChange={handleChange} />;

      case 'task_planner':
        return <TaskPlannerRenderer content={content} onChange={handleChange} />;

      case 'price_calculator':
        return <PriceCalculatorRenderer content={content} onChange={handleChange} />;

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
