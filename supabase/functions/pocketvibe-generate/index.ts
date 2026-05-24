// Supabase Edge Function — pocketvibe-generate
// Runs in Deno. Calls Gemini with the multi-step pipeline server-side.
// Deploy with: supabase functions deploy pocketvibe-generate
// Set secret: supabase secrets set GEMINI_API_KEY=your-key

import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory map — resets when the function cold-starts.
// For production replace with Redis or a Supabase table.
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return true;
  entry.count++;
  return false;
}

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
- generative_html: ONLY as a last resort when none of the above fit

CONTENT FORMATS:

checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }
habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }
budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000},{"id":"exp2","label":"Groceries","category":"Food","amount":2500}],"notes":"" }
savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }
landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do in one line","description":"A short paragraph about what makes you special","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }
event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task description","dueDate":"","done":false}],"guestCount":0,"notes":"" }
meal_planner: { "type":"meal_planner","weekLabel":"This week","meals":[{"id":"m1","day":"Monday","slot":"dinner","name":"Meal name"}],"groceryList":["Ingredient 1"] }
workout_tracker: { "type":"workout_tracker","planName":"My Workout Plan","days":[{"id":"d1","label":"Day 1","exercises":[{"id":"e1","name":"Push-ups","sets":3,"reps":"15"}],"completed":false}] }
survey_form: { "type":"survey_form","title":"Form Title","description":"What this is for","questions":[{"id":"q1","label":"Question?","type":"text","answer":""}] }
task_planner: { "type":"task_planner","planTitle":"My Plan","sections":[{"id":"sec1","title":"This week","tasks":[{"id":"t1","label":"Task","priority":"medium","done":false,"dueDate":""}]}] }

RULES:
- Use practical realistic defaults, not fake values
- All labels must be plain friendly English — no technical jargon
- Make it immediately useful
- Currency: use "R" (ZAR) by default unless the user specifies another
- For improve/add requests: preserve all existing data, only change or add what was asked
- Today's date is ${today}
- Do not hardcode a specific location unless the user mentions one
- Always make something USEFUL and functional, not decorative`;
}

function buildUserMessage(req: Record<string, unknown>): string {
  const parts: string[] = [];
  const mode = req.mode as string;
  const userRequest = req.userRequest as string;
  const currentCreation = req.currentCreation as Record<string, unknown> | undefined;

  if (mode === 'new' || !mode) {
    parts.push(`User request: ${userRequest}`);
  } else if (mode === 'improve' && currentCreation) {
    parts.push('The user wants to improve an existing creation.');
    parts.push(`Improvement request: ${userRequest}`);
    parts.push(`\nCurrent title: ${currentCreation.title}`);
    parts.push(`Current type: ${currentCreation.creationType}`);
    parts.push(`Original request: ${currentCreation.originalRequest}`);
    parts.push(`Current content:\n${JSON.stringify(currentCreation.content, null, 2)}`);
    parts.push('\nApply the improvement. Keep the same creationType unless the user explicitly asks to change it. Preserve all existing data not mentioned.');
  } else if (mode === 'add' && currentCreation) {
    parts.push('The user wants to add to an existing creation.');
    parts.push(`Addition request: ${userRequest}`);
    parts.push(`\nCurrent title: ${currentCreation.title}`);
    parts.push(`Current type: ${currentCreation.creationType}`);
    parts.push(`Current content:\n${JSON.stringify(currentCreation.content, null, 2)}`);
    parts.push('\nAdd what the user requested. Keep all existing data. Only append new items.');
  } else {
    parts.push(`User request: ${userRequest}`);
  }
  return parts.join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const userRequest = body.userRequest as string | undefined;
  if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'userRequest is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (userRequest.length > 2000) {
    return new Response(JSON.stringify({ error: 'userRequest too long (max 2000 chars)' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const locale = body.locale as Record<string, string> | undefined;
  const today = locale?.date ?? new Date().toISOString().slice(0, 10);

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(today),
  });

  const userMessage = buildUserMessage(body);

  try {
    const result = await model.generateContent(userMessage);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // One repair attempt
      const retryResult = await model.generateContent(
        `${userMessage}\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation.`,
      );
      const retryRaw = retryResult.response.text().trim();
      const retryCleaned = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(retryCleaned);
      } catch {
        return new Response(JSON.stringify({ error: 'Could not generate a valid response. Please try again.' }), {
          status: 422,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Generation failed: ${message.slice(0, 200)}` }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
