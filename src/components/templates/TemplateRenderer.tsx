import React, { Suspense, lazy } from 'react';
import type { Creation, CreationContent, GenerationStageEvent } from '../../types';
import type { RecipeContent } from '../../types';
import type { RecipeIntakeInput } from '../../lib/recipePrompt';

// Each renderer is its own chunk: the first paint only pays for the template
// the user actually opens (the biggest ones are 1000+ lines each).
const ChecklistRenderer = lazy(() => import('./ChecklistRenderer').then(m => ({ default: m.ChecklistRenderer })));
const HabitTrackerRenderer = lazy(() => import('./HabitTrackerRenderer').then(m => ({ default: m.HabitTrackerRenderer })));
const BudgetCalculatorRenderer = lazy(() => import('./BudgetCalculatorRenderer').then(m => ({ default: m.BudgetCalculatorRenderer })));
const SavingsTrackerRenderer = lazy(() => import('./SavingsTrackerRenderer').then(m => ({ default: m.SavingsTrackerRenderer })));
const LandingPageRenderer = lazy(() => import('./LandingPageRenderer').then(m => ({ default: m.LandingPageRenderer })));
const EventPlannerRenderer = lazy(() => import('./EventPlannerRenderer').then(m => ({ default: m.EventPlannerRenderer })));
const MealPlannerRenderer = lazy(() => import('./MealPlannerRenderer').then(m => ({ default: m.MealPlannerRenderer })));
const WorkoutTrackerRenderer = lazy(() => import('./WorkoutTrackerRenderer').then(m => ({ default: m.WorkoutTrackerRenderer })));
const TaskPlannerRenderer = lazy(() => import('./TaskPlannerRenderer').then(m => ({ default: m.TaskPlannerRenderer })));
const PriceCalculatorRenderer = lazy(() => import('./PriceCalculatorRenderer').then(m => ({ default: m.PriceCalculatorRenderer })));
const TournamentPoolRenderer = lazy(() => import('./TournamentPoolRenderer').then(m => ({ default: m.TournamentPoolRenderer })));
const IdeaThinkingBoardRenderer = lazy(() => import('./IdeaThinkingBoardRenderer').then(m => ({ default: m.IdeaThinkingBoardRenderer })));
const RecipeRenderer = lazy(() => import('./RecipeRenderer').then(m => ({ default: m.RecipeRenderer })));
const RecipeBookRenderer = lazy(() => import('./RecipeBookRenderer').then(m => ({ default: m.RecipeBookRenderer })));

interface TemplateRendererProps {
  creation: Creation;
  onContentChange: (id: string, content: CreationContent) => void;
  onShare?: () => void;
  pendingLocalAction?: string | null;
  onLocalActionConsumed?: () => void;
  /** Pulls a recipe from a link/text for the cookbook. Absent on shared pages. */
  onExtractRecipe?: (input: RecipeIntakeInput, onStage?: (ev: GenerationStageEvent) => void) => Promise<RecipeContent | null>;
  /** Chat about one recipe (AI has that recipe's context). Absent on shared pages. */
  onRecipeChat?: (recipe: RecipeContent, message: string) => Promise<{ answer?: string; updatedRecipe?: RecipeContent }>;
}

export function TemplateRenderer({ creation, onContentChange, onShare, pendingLocalAction, onLocalActionConsumed, onExtractRecipe, onRecipeChat }: TemplateRendererProps) {
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
        return <IdeaThinkingBoardRenderer content={content} onChange={handleChange} frosted />;

      case 'recipe':
        return <RecipeRenderer content={content} onChange={handleChange} onChat={onRecipeChat ? (msg) => onRecipeChat(content, msg) : undefined} frosted />;

      case 'recipe_book':
        return <RecipeBookRenderer content={content} onChange={handleChange} onExtractRecipe={onExtractRecipe} onRecipeChat={onRecipeChat} frosted />;

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
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <span className="text-violet-400 text-xl animate-pulse">✦</span>
          </div>
        }
      >
        {renderContent()}
      </Suspense>
    </div>
  );
}
