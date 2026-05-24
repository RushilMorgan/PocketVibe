import type { CreationType } from '../types';

export interface IdeaCard {
  id: string;
  emoji: string;
  label: string;
  description: string;
  prompt: string;
  creationType: CreationType;
}

export const IDEA_CARDS: IdeaCard[] = [
  {
    id: 'plan',
    emoji: '📅',
    label: 'Plan something',
    description: 'Event, trip, or party',
    prompt: 'Help me plan a birthday party',
    creationType: 'event_planner',
  },
  {
    id: 'calculator',
    emoji: '🧮',
    label: 'Make a calculator',
    description: 'Budget, savings, or estimate',
    prompt: 'Make me a monthly budget calculator',
    creationType: 'budget_calculator',
  },
  {
    id: 'habit',
    emoji: '🔥',
    label: 'Track a habit',
    description: 'Daily or weekly routine',
    prompt: 'Create a habit tracker for exercise and reading',
    creationType: 'habit_tracker',
  },
  {
    id: 'website',
    emoji: '🌐',
    label: 'Simple website',
    description: 'Side hustle or project',
    prompt: 'Make a simple website for my small business',
    creationType: 'landing_page',
  },
  {
    id: 'checklist',
    emoji: '✅',
    label: 'Create a checklist',
    description: 'Moving, travel, or project',
    prompt: 'Make a checklist for moving house',
    creationType: 'checklist',
  },
  {
    id: 'budget',
    emoji: '💰',
    label: 'Budget tool',
    description: 'Track income and expenses',
    prompt: 'Build a household budget calculator',
    creationType: 'budget_calculator',
  },
  {
    id: 'work',
    emoji: '💼',
    label: 'Work tasks',
    description: 'Projects, goals, to-dos',
    prompt: 'Create a weekly work task tracker',
    creationType: 'task_planner',
  },
  {
    id: 'life',
    emoji: '🗂️',
    label: 'Organise my life',
    description: 'Weekly plan, goals, routines',
    prompt: 'Help me plan and organise my week',
    creationType: 'task_planner',
  },
  {
    id: 'savings',
    emoji: '🎯',
    label: 'Save for something',
    description: 'Goal, holiday, or fund',
    prompt: 'Make me a savings goal tracker',
    creationType: 'savings_tracker',
  },
  {
    id: 'surprise',
    emoji: '🎲',
    label: 'Surprise me',
    description: 'Let AI decide',
    prompt: 'Surprise me with something useful I can use every day',
    creationType: 'checklist',
  },
];
