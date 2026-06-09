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
import { TournamentPoolRenderer } from './TournamentPoolRenderer';
import { IdeaThinkingBoardRenderer } from './IdeaThinkingBoardRenderer';
import { RecipeRenderer } from './RecipeRenderer';
import { RecipeBookRenderer } from './RecipeBookRenderer';
import type { RecipeContent } from '../../types';
import type { RecipeIntakeInput } from '../../lib/recipePrompt';

interface TemplateRendererProps {
  creation: Creation;
  onContentChange: (id: string, content: CreationContent) => void;
  onShare?: () => void;
  pendingLocalAction?: string | null;
  onLocalActionConsumed?: () => void;
  /** Pulls a recipe from a link/text for the cookbook. Absent on shared pages. */
  onExtractRecipe?: (input: RecipeIntakeInput) => Promise<RecipeContent | null>;
}

export function TemplateRenderer({ creation, onContentChange, onShare, pendingLocalAction, onLocalActionConsumed, onExtractRecipe }: TemplateRendererProps) {
  const { content } = creation;
  const hasShareLink = !!creation.shareSlug;

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
        return <WorkoutTrackerRenderer content={content} onChange={handleChange} onShare={onShare} hasShareLink={hasShareLink} />;

      case 'task_planner':
        return <TaskPlannerRenderer content={content} onChange={handleChange} />;

      case 'price_calculator':
        return <PriceCalculatorRenderer content={content} onChange={handleChange} />;

      case 'tournament_pool_tracker':
        return <TournamentPoolRenderer content={content} onChange={handleChange} onShare={onShare} hasShareLink={hasShareLink} pendingLocalAction={pendingLocalAction} onLocalActionConsumed={onLocalActionConsumed} />;

      case 'idea_thinking_board':
        return <IdeaThinkingBoardRenderer content={content} onChange={handleChange} />;

      case 'recipe':
        return <RecipeRenderer content={content} onChange={handleChange} />;

      case 'recipe_book':
        return <RecipeBookRenderer content={content} onChange={handleChange} onExtractRecipe={onExtractRecipe} />;

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
