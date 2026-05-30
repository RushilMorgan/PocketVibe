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
  'Figuring out what you need…',
  'Picking the best format…',
  'Planning the structure…',
  'Building your creation…',
  'Checking the result…',
  'Polishing the details…',
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
- price_calculator: quotes, estimates, invoices, price lists, service calculators
- task_planner: project management, work tasks, weekly or daily planning
- tournament_pool_tracker: private family/friend/office tournament pools and draws, World Cup sweepstakes, team draws with seeded pots

CONTENT FORMATS:

checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }

habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }

budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000},{"id":"exp2","label":"Groceries","category":"Food","amount":2500}],"notes":"" }

savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }

landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do in one line","description":"A short paragraph about what makes you special","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }

event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task description","dueDate":"","done":false}],"guestCount":0,"notes":"" }

meal_planner: { "type":"meal_planner","weekLabel":"This week","meals":[{"id":"m1","day":"Monday","slot":"dinner","name":"Meal name"}],"groceryList":["Ingredient 1","Ingredient 2"] }

workout_tracker: { "type":"workout_tracker","planName":"My Workout Plan","days":[{"id":"d1","label":"Day 1 — Upper Body","exercises":[{"id":"e1","name":"Push-ups","sets":3,"reps":"15"}],"completed":false}] }

price_calculator: { "type":"price_calculator","title":"Service Quote","currency":"R","description":"Quote for services","lineItems":[{"id":"li1","label":"Service name","quantity":1,"unitPrice":500,"category":"Services"},{"id":"li2","label":"Additional item","quantity":2,"unitPrice":150,"category":"Materials"}],"taxRate":15,"notes":"" }

task_planner: { "type":"task_planner","planTitle":"My Plan","sections":[{"id":"sec1","title":"This week","tasks":[{"id":"t1","label":"Task name","priority":"medium","done":false,"dueDate":""}]}] }

tournament_pool_tracker: { "type":"tournament_pool_tracker","poolName":"World Cup Family Pool","tournamentName":"FIFA World Cup 2026","prizeNote":"Winner gets bragging rights and pizza!","adminName":"You","rulesNote":"Each person draws one team from each pot","participants":[{"id":"p1","name":"Alice","emoji":"⭐"},{"id":"p2","name":"Bob","emoji":"🎯"},{"id":"p3","name":"Carol","emoji":"🌟"},{"id":"p4","name":"Dave","emoji":"⚡"}],"teams":[{"id":"t1","name":"Brazil","pot":1,"group":"D","flagEmoji":"🇧🇷","status":"active"},{"id":"t2","name":"France","pot":1,"group":"A","flagEmoji":"🇫🇷","status":"active"},{"id":"t3","name":"Argentina","pot":1,"group":"C","flagEmoji":"🇦🇷","status":"active"},{"id":"t4","name":"England","pot":1,"group":"B","flagEmoji":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","status":"active"},{"id":"t5","name":"Netherlands","pot":2,"group":"E","flagEmoji":"🇳🇱","status":"active"},{"id":"t6","name":"Portugal","pot":2,"group":"H","flagEmoji":"🇵🇹","status":"active"},{"id":"t7","name":"Belgium","pot":2,"group":"F","flagEmoji":"🇧🇪","status":"active"},{"id":"t8","name":"Spain","pot":2,"group":"G","flagEmoji":"🇪🇸","status":"active"}],"matches":[],"drawLocked":false,"scoringRules":{"pointsPerWin":3,"pointsPerDraw":1,"knockoutBonus":5,"quarterFinalBonus":10,"semiFinalBonus":15,"finalBonus":20,"winnerBonus":50} }

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
- Never return raw HTML — always use a structured creationType from the list above
- If the user mentions World Cup, tournament pool, sweepstake, seeded pots, or team draw, use tournament_pool_tracker
- For tournament_pool_tracker: never use gambling language; use friendly draw, private pool, prize note. Do not collect money.`;
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

  onProgress?.(PROGRESS_STEPS[3]);

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

  onProgress?.(PROGRESS_STEPS[4]);
  const data: unknown = await response.json();

  coerceGenerateResponse(data as Record<string, unknown>);
  const validation = validateGenerateResponse(data);
  if (!validation.valid) {
    throw new AIGenerationError('The server returned an unexpected response. Please try again.');
  }

  onProgress?.(PROGRESS_STEPS[5]);
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
      // Edge Function not yet deployed — fall through to direct Gemini (DEV only)
      if (err instanceof AIConfigError && import.meta.env.DEV) {
        return generateViaGemini(req, onProgress);
      }
      throw err;
    }
  }

  // Direct Gemini is only allowed in development; production must use the Edge Function
  if (!import.meta.env.DEV) {
    throw new AIConfigError(
      'Production requires the Supabase Edge Function. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return generateViaGemini(req, onProgress);
}

// ── AI Connection Status ──────────────────────────────────────────────────────

export type AIConnectionReason =
  | 'supabase_configured'
  | 'client_gemini_dev_configured'
  | 'missing_supabase_url'
  | 'missing_supabase_anon_key'
  | 'placeholder_supabase_url'
  | 'old_vercel_key_present_but_not_used'
  | 'production_requires_supabase_edge_function'
  | 'unknown';

export type AIConnectionStatus = {
  connected: boolean;
  activeProvider: 'supabase_edge_function' | 'client_gemini_dev' | 'missing';
  reason: AIConnectionReason;
};

export function getAIConnectionStatus(): AIConnectionStatus {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const placeholder = 'https://your-project-ref.supabase.co';
  const isDev = import.meta.env.DEV as boolean;

  const supabaseValid = !!(supabaseUrl && supabaseUrl !== placeholder && supabaseAnonKey);

  // ✅ Supabase fully configured — use Edge Function (the production path)
  if (supabaseValid) {
    return { connected: true, activeProvider: 'supabase_edge_function', reason: 'supabase_configured' };
  }

  // ✅ Local dev with a Gemini key — direct client fallback is allowed
  if (isDev && geminiKey) {
    return { connected: true, activeProvider: 'client_gemini_dev', reason: 'client_gemini_dev_configured' };
  }

  // ❌ Not connected — diagnose the specific reason

  // Old Vercel Gemini key present but production no longer routes through it
  if (!isDev && geminiKey) {
    console.warn(
      '[PocketVibe] Gemini key exists in Vercel, but production AI now expects Supabase Edge Function config.',
      'Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY and deploy the pocketvibe-generate Edge Function.',
    );
    return { connected: false, activeProvider: 'missing', reason: 'old_vercel_key_present_but_not_used' };
  }

  if (supabaseUrl === placeholder) {
    return { connected: false, activeProvider: 'missing', reason: 'placeholder_supabase_url' };
  }

  if (!supabaseUrl) {
    // Production with no supabase URL at all — common after migrating away from Vercel Gemini
    if (!isDev) {
      return { connected: false, activeProvider: 'missing', reason: 'production_requires_supabase_edge_function' };
    }
    return { connected: false, activeProvider: 'missing', reason: 'missing_supabase_url' };
  }

  if (!supabaseAnonKey) {
    return { connected: false, activeProvider: 'missing', reason: 'missing_supabase_anon_key' };
  }

  return { connected: false, activeProvider: 'missing', reason: 'unknown' };
}

// ── Chat with an existing creation (fast path) ────────────────────────────────

export type ChatResult =
  | { type: 'answer'; text: string }
  | { type: 'modify' };

/**
 * Sends a single message to the AI with the creation's current data as context.
 * Returns either a factual answer (Q&A) or { type: 'modify' } to escalate to
 * the full generation pipeline.
 *
 * Production: calls the Supabase Edge Function (mode:'chat').
 * Dev fallback: calls Gemini directly with a simplified prompt.
 */
export async function chatWithCreation(
  creation: Creation,
  userMessage: string,
): Promise<ChatResult> {
  const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const placeholder     = 'https://your-project-ref.supabase.co';

  // ── Production: Supabase Edge Function ───────────────────────────────────────
  if (supabaseUrl && supabaseUrl !== placeholder && supabaseAnonKey) {
    const res = await fetch(`${supabaseUrl}/functions/v1/pocketvibe-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        mode: 'chat',
        // userRequest is required by the edge function's top-level guard
        userRequest: userMessage,
        userMessage,
        creationType: creation.creationType,
        content: creation.content,
      }),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = await res.text(); } catch { /* ignore */ }
      console.error('[chatWithCreation] Edge function error:', res.status, detail.slice(0, 200));
      throw new AIGenerationError('Chat failed. Please try again.');
    }

    const data = await res.json() as { answer?: string; action?: string; error?: string };
    if (data.error) throw new AIGenerationError(data.error);
    if (data.action === 'modify') return { type: 'modify' };
    if (data.answer)              return { type: 'answer', text: data.answer };
    throw new AIGenerationError('Unexpected response. Please try again.');
  }

  // ── Dev fallback: direct Gemini ───────────────────────────────────────────────
  if (!import.meta.env.DEV) {
    throw new AIConfigError('Production requires the Supabase Edge Function.');
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new AIConfigError('No AI configured for chat.');

  const today  = new Date().toISOString().slice(0, 10);
  const genAI  = new GoogleGenerativeAI(apiKey);
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Inline dev prompt — mirrors the edge function's buildChatPrompt logic
  const prompt = [
    'You are Toolie, a friendly AI assistant embedded in a PocketVibe tool.',
    `Today is ${today}.`,
    `Creation type: ${creation.creationType}`,
    `Tool data (JSON): ${JSON.stringify(creation.content).slice(0, 600)}`,
    '',
    `User says: "${userMessage}"`,
    '',
    'Answer factual questions in 1-3 plain sentences.',
    'If the user wants to change/add/update anything, respond with exactly: ACTION:MODIFY',
    'Never mix an answer with ACTION:MODIFY.',
  ].join('\n');

  const result = await model.generateContent(prompt);
  const raw    = result.response.text().trim();

  if (raw === 'ACTION:MODIFY' || raw.startsWith('ACTION:MODIFY')) return { type: 'modify' };
  return { type: 'answer', text: raw || "I'm not sure — try asking in a different way." };
}

// ── Offline fallback ──────────────────────────────────────────────────────────

export function generateOfflineFallback(userRequest: string): GenerateResponse {
  const lower = userRequest.toLowerCase();

  // Tournament pool check runs FIRST — before workout, since "pool/draw" can overlap
  if (/world.?cup|tournament.*pool|pool.*draw|sweepstake|sweepstakes|office.?draw|family.?draw|seeded.?pot|pot.*draw|draw.*team|prize.*pool|friendly.*draw|team.*pool/.test(lower)) {
    return {
      title: 'Tournament Pool',
      creationType: 'tournament_pool_tracker',
      description: 'A friendly draw with teams, participants, and a leaderboard',
      summary: 'Here is your tournament pool! Add participants, draw teams, and track results.',
      content: {
        type: 'tournament_pool_tracker',
        poolName: 'Tournament Pool',
        tournamentName: 'Tournament',
        prizeNote: 'Winner gets the prize!',
        participants: [
          { id: 'p1', name: 'Player 1', emoji: '⭐' },
          { id: 'p2', name: 'Player 2', emoji: '🎯' },
        ],
        teams: [
          { id: 't1', name: 'Team A', pot: 1, status: 'active' as const },
          { id: 't2', name: 'Team B', pot: 1, status: 'active' as const },
          { id: 't3', name: 'Team C', pot: 2, status: 'active' as const },
          { id: 't4', name: 'Team D', pot: 2, status: 'active' as const },
        ],
        matches: [],
        drawLocked: false,
        scoringRules: {
          pointsPerWin: 3,
          pointsPerDraw: 1,
          knockoutBonus: 5,
          quarterFinalBonus: 10,
          semiFinalBonus: 15,
          finalBonus: 20,
          winnerBonus: 50,
        },
      },
    };
  }

  // Challenge / workout check runs before habit_tracker, since "run/walk/track" could overlap
  if (/walk|walking|run|running|partner|leaderboard|score|points|challenge|compete|competition|workout|gym|exercise|fitness|training/.test(lower)) {
    return {
      title: 'Partner Challenge',
      creationType: 'workout_tracker',
      description: 'Track your walking and running challenge with points',
      summary: 'Here is your challenge tracker. Log activities, earn points, and see who wins!',
      content: {
        type: 'workout_tracker',
        planName: 'Partner Challenge',
        challengeMode: true,
        participants: [
          { id: 'p1', name: 'You', emoji: '🏃' },
          { id: 'p2', name: 'Partner', emoji: '🚶' },
        ],
        activityTypes: ['walk', 'run', 'gym', 'other'],
        weeklyTarget: 3,
        logs: [],
        scoringRules: {
          pointsPerActivity: 10,
          weeklyTargetBonus: 20,
          runningBonus: 5,
        },
      },
    };
  }

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

  if (/landing|website|page|portfolio|business/.test(lower)) {
    return {
      title: 'My Landing Page',
      creationType: 'landing_page',
      description: 'A simple landing page for your business or project',
      summary: 'Here is a landing page to showcase your business. You can edit any of the fields directly.',
      content: {
        type: 'landing_page',
        businessName: 'My Business',
        tagline: 'What we do in one line',
        description: 'A short paragraph about what makes your business special.',
        features: [
          { icon: '⭐', title: 'Quality', description: 'We deliver the best quality' },
          { icon: '🚀', title: 'Fast', description: 'Quick and reliable service' },
          { icon: '💬', title: 'Support', description: 'We are always here to help' },
        ],
        ctaLabel: 'Get in touch',
        ctaUrl: '',
        contactEmail: '',
      },
    };
  }

  if (/event|party|wedding|birthday|plan a/.test(lower)) {
    return {
      title: 'Event Planner',
      creationType: 'event_planner',
      description: 'Plan your event with a task list',
      summary: 'Here is an event planner to keep track of everything you need to do.',
      content: {
        type: 'event_planner',
        eventName: 'My Event',
        eventDate: '',
        tasks: [
          { id: 't1', label: 'Book venue', dueDate: '', done: false },
          { id: 't2', label: 'Send invitations', dueDate: '', done: false },
          { id: 't3', label: 'Arrange catering', dueDate: '', done: false },
        ],
        guestCount: 0,
        notes: '',
      },
    };
  }

  if (/meal|food|recipe|grocery|eat/.test(lower)) {
    return {
      title: 'Weekly Meal Planner',
      creationType: 'meal_planner',
      description: 'Plan your meals for the week',
      summary: 'Here is a weekly meal planner. Add meals for each day and build your grocery list.',
      content: {
        type: 'meal_planner',
        weekLabel: 'This week',
        meals: [
          { id: 'm1', day: 'Monday', slot: 'dinner', name: 'Pasta' },
          { id: 'm2', day: 'Tuesday', slot: 'dinner', name: 'Chicken stir-fry' },
          { id: 'm3', day: 'Wednesday', slot: 'dinner', name: 'Grilled fish' },
        ],
        groceryList: ['Pasta', 'Chicken', 'Fish', 'Vegetables', 'Olive oil'],
      },
    };
  }

  if (/task|project|sprint|work|to.do/.test(lower)) {
    return {
      title: 'Task Planner',
      creationType: 'task_planner',
      description: 'Organise your tasks by section',
      summary: 'Here is a task planner. Add tasks and check them off as you go.',
      content: {
        type: 'task_planner',
        planTitle: 'My Plan',
        sections: [
          {
            id: 'sec1',
            title: 'This week',
            tasks: [
              { id: 't1', label: 'First task', priority: 'high', done: false, dueDate: '' },
              { id: 't2', label: 'Second task', priority: 'medium', done: false, dueDate: '' },
              { id: 't3', label: 'Third task', priority: 'low', done: false, dueDate: '' },
            ],
          },
        ],
      },
    };
  }

  if (/price|quote|invoice|cost|estimate/.test(lower)) {
    return {
      title: 'Price Calculator',
      creationType: 'price_calculator',
      description: 'Calculate a price or quote',
      summary: 'Here is a price calculator. Add your line items and adjust quantities to get a total.',
      content: {
        type: 'price_calculator',
        title: 'Service Quote',
        currency: 'R',
        description: '',
        lineItems: [
          { id: 'li1', label: 'Service', quantity: 1, unitPrice: 500, category: 'Services' },
          { id: 'li2', label: 'Materials', quantity: 2, unitPrice: 150, category: 'Materials' },
        ],
        taxRate: 15,
        notes: '',
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


export type { Creation };

