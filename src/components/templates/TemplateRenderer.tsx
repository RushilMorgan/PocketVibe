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

    case 'generative_html': {
      // Sanitized iframe-based renderer for fully generative HTML
      const markup = content.tailwindMarkup ?? '';
      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>body{margin:0;padding:1rem;font-family:system-ui,sans-serif}</style>
      </head><body>${markup}</body></html>`;
      return (
        <iframe
          sandbox="allow-scripts"
          title={creation.title}
          srcDoc={html}
          className="w-full flex-1 border-0"
          style={{ minHeight: '400px', height: '100%' }}
        />
      );
    }

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
