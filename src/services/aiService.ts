// ── FILE REPLACED — see full implementation below ────────────────────────────
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateRequest, GenerateResponse, Creation } from '../types';
import { validateGenerateResponse, coerceGenerateResponse } from '../lib/validator';

// ── Error types ───────────────────────────────────────────────────────────────

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}

export class AIGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIGenerationError';
  }
}

// Kept for tests that reference the old name
export { AIConfigError as GeminiConfigError };

// ── Progress messages ─────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  'Understanding what you want to make…',
  'Sketching the first version…',
  'Checking it works on mobile…',
  'Polishing it…',
];

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(today: string): string {
  return `You are PocketVibe, an AI that turns everyday ideas into useful tools and mini-applications. You help normal people — not developers — create things they can actually use right now.

Output ONLY a valid JSON object. No markdown fences, no explanation, no extra text outside the JSON.

Use this exact structure:
{
  "title": "Short friendly title (max 60 chars)",
  "creationType": "one of the supported types listed below",
  "description": "One sentence describing what this is",
  "summary": "1-2 warm friendly sentences for the user, e.g. 'I made you a savings tracker. You can set your goal and log monthly contributions towards it.'",
  "content": { ...type-specific fields... }
}

SUPPORTED CREATION TYPES — always choose the most useful one:
- checklist: task lists, packing lists, to-do lists, moving or launch checklists
- habit_tracker: tracking daily or weekly habits, routines, health goals
- budget_calculator: income vs expenses, financial planning, budgeting
- savings_tracker: saving towards a specific goal (holiday, gadget, emergency fund)
- landing_page: simple websites, business pages, side hustles, portfolios
- event_planner: planning events, parties, trips, projects with task lists
- meal_planner: meal prep, weekly meals, grocery planning
- workout_tracker: gym plans, exercise routines, fitness goals
- survey_form: forms, questionnaires, gathering information
- task_planner: project management, work tasks, weekly or daily planning

CONTENT FORMATS:

checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }

habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }

budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000},{"id":"exp2","label":"Groceries","category":"Food","amount":2500}],"notes":"" }

savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }

landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do in one line","description":"A short paragraph about what makes you special","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }

event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task description","dueDate":"","done":false}],"guestCount":0,"notes":"" }

meal_planner: { "type":"meal_planner","weekLabel":"This week","meals":[{"id":"m1","day":"Monday","slot":"dinner","name":"Meal name"}],"groceryList":["Ingredient 1","Ingredient 2"] }

workout_tracker: { "type":"workout_tracker","planName":"My Workout Plan","days":[{"id":"d1","label":"Day 1 — Upper Body","exercises":[{"id":"e1","name":"Push-ups","sets":3,"reps":"15"}],"completed":false}] }

survey_form: { "type":"survey_form","title":"Form Title","description":"What this form is for","questions":[{"id":"q1","label":"Question?","type":"text","answer":""}] }

task_planner: { "type":"task_planner","planTitle":"My Plan","sections":[{"id":"sec1","title":"This week","tasks":[{"id":"t1","label":"Task name","priority":"medium","done":false,"dueDate":""}]}] }

RULES:
- Use practical realistic defaults, not fake values like "John Doe" or "$99"
- All labels must be plain friendly English — no technical jargon
- Make it immediately useful — the user should be able to use it the moment it loads
- Currency: use "R" (ZAR) by default unless the user specifies another
- For improve/add requests: preserve all existing data, only change or add what was asked
- Today's date is ${today} — use this for date-sensitive content
- Do not hardcode a specific location or city unless the user mentions one
- Always make something USEFUL and functional, not decorative or fake
- If the user asks for a website or landing page, use landing_page
- If the user asks for an app or custom tool, pick the closest structured template
- Never return raw HTML — always use a structured creationType from the list above`;
}

function buildUserMessage(req: GenerateRequest): string {
  const parts: string[] = [];
  if (req.mode === 'new') {
    parts.push(`User request: ${req.userRequest}`);
  } else if (req.mode === 'improve' && req.currentCreation) {
    parts.push('The user wants to improve an existing creation.');
    parts.push(`Improvement request: ${req.userRequest}`);
    parts.push(`\nCurrent creation title: ${req.currentCreation.title}`);
    parts.push(`Current creation type: ${req.currentCreation.creationType}`);
    parts.push(`Original request: ${req.currentCreation.originalRequest}`);
    parts.push(`Current content:\n${JSON.stringify(req.currentCreation.content, null, 2)}`);
    parts.push('\nInstructions: Apply the improvement. Keep the same creationType unless the user explicitly asks to change it. Preserve all existing data that was not mentioned. Keep all existing items/habits/tasks and only modify what was requested.');
  } else if (req.mode === 'add' && req.currentCreation) {
    parts.push('The user wants to add to an existing creation.');
    parts.push(`Addition request: ${req.userRequest}`);
    parts.push(`\nCurrent creation title: ${req.currentCreation.title}`);
    parts.push(`Current creation type: ${req.currentCreation.creationType}`);
    parts.push(`Current content:\n${JSON.stringify(req.currentCreation.content, null, 2)}`);
    parts.push('\nInstructions: Add what the user requested. Keep all existing data. Only append new items/sections/habits/tasks as appropriate.');
  } else {
    parts.push(`User request: ${req.userRequest}`);
  }
  return parts.join('\n');
}

// ── Direct Gemini fallback (dev mode — key stays local only) ─────────────────

async function generateViaGemini(
  req: GenerateRequest,
  onProgress?: (status: string) => void,
): Promise<GenerateResponse> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new AIConfigError(
      'No AI configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for production, or VITE_GEMINI_API_KEY for local development.',
    );
  }

  const today = req.locale?.date ?? new Date().toISOString().slice(0, 10);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(today),
  });

  onProgress?.(PROGRESS_STEPS[0]);
  const userMessage = buildUserMessage(req);
  onProgress?.(PROGRESS_STEPS[1]);

  const result = await model.generateContent(userMessage);
  onProgress?.(PROGRESS_STEPS[2]);

  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIGenerationError('Could not understand the response. Please try again with more detail.');
  }

  coerceGenerateResponse(parsed as Record<string, unknown>);
  const validation = validateGenerateResponse(parsed);

  if (!validation.valid) {
    // One repair attempt
    onProgress?.('Trying to fix it…');
    const retryResult = await model.generateContent(
      `${userMessage}\n\nIMPORTANT: Your previous response had these issues: ${validation.errors.join(', ')}. Fix them and return valid JSON only.`,
    );
    const retryRaw = retryResult.response.text().trim();
    const retryCleaned = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(retryCleaned);
      coerceGenerateResponse(parsed as Record<string, unknown>);
      const retryValidation = validateGenerateResponse(parsed);
      if (!retryValidation.valid) {
        throw new AIGenerationError('Something went wrong. Please try again with a more specific request.');
      }
    } catch (e) {
      if (e instanceof AIGenerationError) throw e;
      throw new AIGenerationError('Something went wrong. Please try again with a more specific request.');
    }
  }

  onProgress?.(PROGRESS_STEPS[3]);
  return parsed as GenerateResponse;
}

// ── Supabase Edge Function client ─────────────────────────────────────────────

async function generateViaEdgeFunction(
  req: GenerateRequest,
  onProgress?: (status: string) => void,
): Promise<GenerateResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AIConfigError('Supabase not configured.');
  }

  onProgress?.(PROGRESS_STEPS[0]);

  const response = await fetch(`${supabaseUrl}/functions/v1/pocketvibe-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(req),
  });

  onProgress?.(PROGRESS_STEPS[1]);

  if (!response.ok) {
    // Read the body for developer debugging — but never expose it to users
    let devBody = '';
    try { devBody = await response.text(); } catch { devBody = response.statusText; }
    console.error('[PocketVibe] Edge function error:', response.status, devBody.slice(0, 500));

    const STATUS_MESSAGES: Record<number, string> = {
      404: 'The AI service is not deployed correctly yet.',
      401: 'The AI service is not authorised correctly.',
      403: 'The AI service is not authorised correctly.',
      429: 'Too many requests. Please try again shortly.',
      500: 'The AI service had a problem. Please try again.',
      502: 'The AI service had a problem. Please try again.',
      503: 'The AI service is temporarily unavailable. Please try again.',
    };

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const userMessage =
      STATUS_MESSAGES[response.status] ??
      (isJson ? 'The AI service returned an error. Please try again.' : 'The AI service returned an unexpected response.');

    throw new AIGenerationError(userMessage);
  }

  onProgress?.(PROGRESS_STEPS[2]);
  const data: unknown = await response.json();

  coerceGenerateResponse(data as Record<string, unknown>);
  const validation = validateGenerateResponse(data);
  if (!validation.valid) {
    throw new AIGenerationError('The server returned an unexpected response. Please try again.');
  }

  onProgress?.(PROGRESS_STEPS[3]);
  return data as GenerateResponse;
}

// ── Public generate API ───────────────────────────────────────────────────────

export async function generateCreation(
  req: GenerateRequest,
  onProgress?: (status: string) => void,
): Promise<GenerateResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const placeholder = 'https://your-project-ref.supabase.co';

  // Prefer server-side Edge Function — keeps Gemini key off the client bundle
  if (supabaseUrl && supabaseUrl !== placeholder) {
    try {
      return await generateViaEdgeFunction(req, onProgress);
    } catch (err) {
      // Edge Function not yet deployed — fall through to direct Gemini
      if (err instanceof AIConfigError) {
        return generateViaGemini(req, onProgress);
      }
      throw err;
    }
  }

  return generateViaGemini(req, onProgress);
}

// ── Offline fallback ──────────────────────────────────────────────────────────

export function generateOfflineFallback(userRequest: string): GenerateResponse {
  const lower = userRequest.toLowerCase();

  if (/habit|routine|daily|track|streak/.test(lower)) {
    return {
      title: 'Habit Tracker',
      creationType: 'habit_tracker',
      description: 'Track your daily habits',
      summary: 'Here is a simple habit tracker to get you started. Tap any day to mark a habit as done.',
      content: {
        type: 'habit_tracker',
        startDate: new Date().toISOString().slice(0, 10),
        habits: [
          { id: 'h1', name: 'Exercise', icon: '🏃', frequency: 'daily', completions: {} },
          { id: 'h2', name: 'Read', icon: '📚', frequency: 'daily', completions: {} },
          { id: 'h3', name: 'Drink water', icon: '💧', frequency: 'daily', completions: {} },
        ],
      },
    };
  }

  if (/budget|money|expense|spend|income/.test(lower)) {
    return {
      title: 'Monthly Budget',
      creationType: 'budget_calculator',
      description: 'Track your monthly income and expenses',
      summary: 'Here is a budget calculator to help you see where your money goes each month.',
      content: {
        type: 'budget_calculator',
        currency: 'R',
        income: [{ id: 'inc1', label: 'Main income', amount: 20000 }],
        expenses: [
          { id: 'exp1', label: 'Rent', category: 'Housing', amount: 5000 },
          { id: 'exp2', label: 'Groceries', category: 'Food', amount: 2500 },
          { id: 'exp3', label: 'Transport', category: 'Transport', amount: 1500 },
        ],
        notes: '',
      },
    };
  }

  if (/save|saving|goal|holiday|fund/.test(lower)) {
    return {
      title: 'Savings Tracker',
      creationType: 'savings_tracker',
      description: 'Track your savings towards a goal',
      summary: 'Here is a savings tracker. Set your goal amount and log contributions as you go.',
      content: {
        type: 'savings_tracker',
        goalName: 'My Savings Goal',
        targetAmount: 10000,
        currentAmount: 0,
        currency: 'R',
        deadline: '',
        contributions: [],
      },
    };
  }

  return {
    title: 'My Checklist',
    creationType: 'checklist',
    description: 'A simple checklist to get you started',
    summary: 'Here is a checklist. Tap any item to mark it as done.',
    content: {
      type: 'checklist',
      sections: [
        {
          id: 's1',
          title: 'To do',
          items: [
            { id: 'i1', label: 'First task', checked: false },
            { id: 'i2', label: 'Second task', checked: false },
            { id: 'i3', label: 'Third task', checked: false },
          ],
        },
      ],
    },
  };
}

// ── Legacy compat exports ─────────────────────────────────────────────────────

export async function generateBlocks(
  prompt: string,
  _currentBlocks: unknown[] = [],
  onUpdateProgress?: (status: string) => void,
): Promise<unknown[]> {
  const res = await generateCreation({ userRequest: prompt, mode: 'new' }, onUpdateProgress);
  return [{ type: 'hero_banner', id: `gen-${Date.now()}`, title: res.title, subtitle: res.description, ctaLabel: 'View' }];
}

export type { Creation };

