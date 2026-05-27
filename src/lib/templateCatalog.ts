import type { CreationType } from '../types';

export interface IdeaCard {
  id: string;
  emoji: string;
  label: string;
  description: string;
  prompt: string;
  creationType: CreationType;
}

export interface StarterPrompt {
  prompt: string;
  label: string;
  creationType: CreationType;
}

export interface TemplateCategory {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  starters: StarterPrompt[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'finance',
    emoji: '💰',
    name: 'Finance',
    tagline: 'Budget, savings & quotes',
    starters: [
      { label: 'Monthly budget', prompt: 'Make me a monthly household budget tracker', creationType: 'budget_calculator' },
      { label: 'Savings goal', prompt: 'Make me a savings goal tracker for a holiday', creationType: 'savings_tracker' },
      { label: 'Price list', prompt: 'Make me a price calculator for my freelance services', creationType: 'price_calculator' },
      { label: 'Side hustle budget', prompt: 'Build a budget calculator for my small business', creationType: 'budget_calculator' },
    ],
  },
  {
    id: 'habits',
    emoji: '🔥',
    name: 'Goals & Habits',
    tagline: 'Daily routines & streaks',
    starters: [
      { label: 'Morning routine', prompt: 'Create a daily morning routine habit tracker', creationType: 'habit_tracker' },
      { label: 'Fitness habits', prompt: 'Make a habit tracker for exercise, water intake, and sleep', creationType: 'habit_tracker' },
      { label: 'Study habits', prompt: 'Create a weekly study habit tracker', creationType: 'habit_tracker' },
      { label: 'Health goals', prompt: 'Make a habit tracker for healthy eating and exercise', creationType: 'habit_tracker' },
    ],
  },
  {
    id: 'planning',
    emoji: '📅',
    name: 'Planning',
    tagline: 'Events, tasks & projects',
    starters: [
      { label: 'Plan a party', prompt: 'Help me plan a birthday party', creationType: 'event_planner' },
      { label: 'Work project', prompt: 'Create a project task tracker with milestones', creationType: 'task_planner' },
      { label: 'Weekly tasks', prompt: 'Make a weekly work task planner', creationType: 'task_planner' },
      { label: 'Plan a trip', prompt: 'Help me plan a holiday trip with tasks and checklist', creationType: 'event_planner' },
    ],
  },
  {
    id: 'food',
    emoji: '🍽️',
    name: 'Food & Meals',
    tagline: 'Meal plans & grocery lists',
    starters: [
      { label: 'Weekly meal plan', prompt: 'Create a 7-day meal plan with a grocery list', creationType: 'meal_planner' },
      { label: 'Healthy eating', prompt: 'Make a healthy meal plan for the week', creationType: 'meal_planner' },
      { label: 'Family meals', prompt: 'Create a family meal planner for the week with grocery list', creationType: 'meal_planner' },
      { label: 'Meal prep', prompt: 'Create a meal prep plan for Sunday cooking', creationType: 'meal_planner' },
    ],
  },
  {
    id: 'fitness',
    emoji: '💪',
    name: 'Fitness',
    tagline: 'Workout plans & tracking',
    starters: [
      { label: 'Partner challenge', prompt: 'Create a walking and running challenge for me and my partner. We want to do 3 sessions per week, earn points, and see a leaderboard.', creationType: 'workout_tracker' },
      { label: 'Gym plan', prompt: 'Create a 5-day gym workout plan', creationType: 'workout_tracker' },
      { label: 'Home workout', prompt: 'Make a home workout plan with no equipment', creationType: 'workout_tracker' },
      { label: 'Beginner plan', prompt: 'Create a beginner 3-day workout plan', creationType: 'workout_tracker' },
      { label: 'Running plan', prompt: 'Make a running training plan for a 5K', creationType: 'workout_tracker' },
    ],
  },
  {
    id: 'business',
    emoji: '🌐',
    name: 'Business',
    tagline: 'Websites & landing pages',
    starters: [
      { label: 'Landing page', prompt: 'Make a simple website for my small business', creationType: 'landing_page' },
      { label: 'Portfolio page', prompt: 'Create a portfolio landing page for a freelance designer', creationType: 'landing_page' },
      { label: 'Product page', prompt: 'Make a product landing page for my handmade jewelry', creationType: 'landing_page' },
      { label: 'Service page', prompt: 'Create a services landing page for a cleaning business', creationType: 'landing_page' },
    ],
  },
  {
    id: 'lists',
    emoji: '✅',
    name: 'Checklists',
    tagline: 'Step-by-step & to-do lists',
    starters: [
      { label: 'Moving house', prompt: 'Make a complete moving house checklist', creationType: 'checklist' },
      { label: 'Travel packing', prompt: 'Create a travel packing checklist for a beach holiday', creationType: 'checklist' },
      { label: 'Launch checklist', prompt: 'Make a product launch checklist', creationType: 'checklist' },
      { label: 'Daily to-do', prompt: 'Create a daily productivity checklist', creationType: 'checklist' },
    ],
  },
  {
    id: 'fun',
    emoji: '🎉',
    name: 'Fun & Challenges',
    tagline: 'Pools, draws & friendly competitions',
    starters: [
      { label: 'World Cup pool', prompt: 'My family is doing a World Cup draw. We are putting money together, each person draws teams from seeded pots, and whoever has the winning team gets the prize.', creationType: 'tournament_pool_tracker' },
      { label: 'Office sweepstake', prompt: 'Create an office sweepstake for the football tournament with 8 participants drawing teams from seeded pots and a prize for the winner', creationType: 'tournament_pool_tracker' },
      { label: 'Family draw', prompt: 'Set up a friendly family tournament pool with 4 participants drawing teams from seeded pots and tracking results', creationType: 'tournament_pool_tracker' },
      { label: 'Friends pool', prompt: 'Create a friends tournament pool with pots, a draw, and a leaderboard to track who wins', creationType: 'tournament_pool_tracker' },
    ],
  },
  {
    id: 'surprise',
    emoji: '🎲',
    name: 'Surprise me',
    tagline: 'Let AI pick something useful',
    starters: [
      { label: 'Something useful', prompt: 'Surprise me with something useful I can use every day', creationType: 'checklist' },
      { label: 'For my lifestyle', prompt: 'Make something useful based on a healthy lifestyle', creationType: 'habit_tracker' },
      { label: 'For productivity', prompt: 'Make something that will help me be more productive', creationType: 'task_planner' },
      { label: 'Random useful tool', prompt: 'Create a useful everyday tool — your choice!', creationType: 'checklist' },
    ],
  },
];

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
    id: 'price',
    emoji: '🧾',
    label: 'Price calculator',
    description: 'Quote, estimate, or invoice',
    prompt: 'Make me a price calculator for my small business services',
    creationType: 'price_calculator',
  },
  {
    id: 'meals',
    emoji: '🍽️',
    label: 'Meal planner',
    description: 'Weekly meals and grocery list',
    prompt: 'Create a weekly meal planner with a grocery list',
    creationType: 'meal_planner',
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
