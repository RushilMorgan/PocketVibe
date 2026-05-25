// Supabase Edge Function — pocketvibe-generate
// 7-Step Pipeline: Intent → Type Selector → Content Spec → Builder → QA → Repair → Final
// Deploy: supabase functions deploy pocketvibe-generate
// Secret: supabase secrets set GEMINI_API_KEY=your-key

import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Rate limiting ──────────────────────────────────────────────────────────────
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

// ── Supported types ────────────────────────────────────────────────────────────
const SUPPORTED_TYPES = [
  'checklist', 'habit_tracker', 'budget_calculator', 'savings_tracker',
  'landing_page', 'event_planner', 'meal_planner', 'workout_tracker',
  'price_calculator', 'task_planner',
] as const;
type SupportedType = typeof SUPPORTED_TYPES[number];

// ── Visible signature (mirrors src/lib/visibleSignature.ts) ───────────────────
function getVisibleSignature(content: Record<string, unknown>): string {
  const type = content.type as string;
  if (type === 'habit_tracker') {
    const habits = (content.habits as Array<{name:string;icon:string;frequency:string}> ?? []);
    return JSON.stringify({ habits: habits.map(h => ({ name: h.name, icon: h.icon, frequency: h.frequency })), startDate: content.startDate });
  }
  if (type === 'checklist') {
    const sections = (content.sections as Array<{title:string;items:Array<{label:string;checked:boolean}>}> ?? []);
    return JSON.stringify({ sections: sections.map(s => ({ title: s.title, items: s.items.map(i => ({ label: i.label, checked: i.checked })) })) });
  }
  if (type === 'budget_calculator') {
    return JSON.stringify({
      currency: content.currency,
      income: (content.income as Array<{label:string;amount:number}> ?? []).map(l => ({ label: l.label, amount: l.amount })),
      expenses: (content.expenses as Array<{label:string;amount:number}> ?? []).map(l => ({ label: l.label, amount: l.amount })),
    });
  }
  if (type === 'savings_tracker') {
    return JSON.stringify({ goalName: content.goalName, targetAmount: content.targetAmount, currentAmount: content.currentAmount });
  }
  if (type === 'landing_page') {
    return JSON.stringify({ businessName: content.businessName, tagline: content.tagline, description: content.description, featureTitles: (content.features as Array<{title:string}> ?? []).map(f => f.title) });
  }
  if (type === 'price_calculator') {
    return JSON.stringify({ currency: content.currency, taxRate: content.taxRate, lineItems: (content.lineItems as Array<{label:string;quantity:number;unitPrice:number}> ?? []).map(l => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice })) });
  }
  if (type === 'event_planner') {
    return JSON.stringify({ eventName: content.eventName, eventDate: content.eventDate, tasks: (content.tasks as Array<{label:string}> ?? []).map(t => t.label) });
  }
  if (type === 'meal_planner') {
    return JSON.stringify({ weekLabel: content.weekLabel, meals: (content.meals as Array<{day:string;slot:string;name:string}> ?? []).map(m => ({ day: m.day, slot: m.slot, name: m.name })) });
  }
  if (type === 'workout_tracker') {
    return JSON.stringify({ planName: content.planName, days: (content.days as Array<{label:string;exercises:Array<{name:string}>}> ?? []).map(d => ({ label: d.label, exercises: d.exercises.map(e => e.name) })) });
  }
  if (type === 'task_planner') {
    return JSON.stringify({ planTitle: content.planTitle, sections: (content.sections as Array<{title:string;tasks:Array<{label:string}>}> ?? []).map(s => ({ title: s.title, tasks: s.tasks.map(t => t.label) })) });
  }
  return JSON.stringify(content);
}

// ── Diff helpers ──────────────────────────────────────────────────────────────
function describeChanges(oldContent: Record<string, unknown>, newContent: Record<string, unknown>): string[] {
  const changes: string[] = [];
  const type = newContent.type as string;

  if (type === 'habit_tracker') {
    const oldHabits = (oldContent.habits as Array<{name:string}> ?? []).map(h => h.name);
    const newHabits = (newContent.habits as Array<{name:string}> ?? []).map(h => h.name);
    const added = newHabits.filter(n => !oldHabits.includes(n));
    const removed = oldHabits.filter(n => !newHabits.includes(n));
    if (added.length) changes.push(`Added habits: ${added.join(', ')}`);
    if (removed.length) changes.push(`Removed habits: ${removed.join(', ')}`);
    if (!added.length && !removed.length) changes.push('Updated habit details');
  } else if (type === 'checklist') {
    const oldCount = (oldContent.sections as Array<{items:unknown[]}> ?? []).reduce((n, s) => n + s.items.length, 0);
    const newCount = (newContent.sections as Array<{items:unknown[]}> ?? []).reduce((n, s) => n + s.items.length, 0);
    if (newCount > oldCount) changes.push(`Added ${newCount - oldCount} item(s)`);
    else if (newCount < oldCount) changes.push(`Removed ${oldCount - newCount} item(s)`);
    else changes.push('Updated checklist items');
  } else if (type === 'budget_calculator') {
    const oldExpCount = (oldContent.expenses as unknown[] ?? []).length;
    const newExpCount = (newContent.expenses as unknown[] ?? []).length;
    if (newExpCount > oldExpCount) changes.push(`Added ${newExpCount - oldExpCount} expense(s)`);
    else changes.push('Updated budget');
  } else if (type === 'price_calculator') {
    const oldCount = (oldContent.lineItems as unknown[] ?? []).length;
    const newCount = (newContent.lineItems as unknown[] ?? []).length;
    if (newCount > oldCount) changes.push(`Added ${newCount - oldCount} item(s)`);
    else changes.push('Updated price list');
  } else if (type === 'task_planner') {
    const oldCount = (oldContent.sections as Array<{tasks:unknown[]}> ?? []).reduce((n, s) => n + s.tasks.length, 0);
    const newCount = (newContent.sections as Array<{tasks:unknown[]}> ?? []).reduce((n, s) => n + s.tasks.length, 0);
    if (newCount > oldCount) changes.push(`Added ${newCount - oldCount} task(s)`);
    else changes.push('Updated tasks');
  } else {
    changes.push('Updated content');
  }
  return changes;
}

// ── JSON parse with fence stripping ──────────────────────────────────────────
function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

// ── Pipeline prompts ──────────────────────────────────────────────────────────

/**
 * Step 1+2: Intent Analysis + Template Selector
 * Returns a tiny JSON: { creationType, keyRequirements[], tone, isModification }
 */
function buildIntentPrompt(body: Record<string, unknown>, today: string): string {
  const userRequest = body.userRequest as string;
  const mode = (body.mode as string) ?? 'new';
  const current = body.currentCreation as Record<string, unknown> | undefined;

  const typeDescriptions = `
- checklist: task lists, packing lists, to-do lists, moving or launch checklists
- habit_tracker: tracking daily or weekly habits, routines, health goals
- budget_calculator: income vs expenses, financial planning, budgeting
- savings_tracker: saving towards a specific goal (holiday, gadget, emergency fund)
- landing_page: simple websites, business pages, side hustles, portfolios
- event_planner: planning events, parties, trips, projects with task lists
- meal_planner: meal prep, weekly meals, grocery planning
- workout_tracker: gym plans, exercise routines, fitness goals
- price_calculator: quotes, estimates, invoices, price lists, service calculators
- task_planner: project management, work tasks, weekly or daily planning`;

  const parts: string[] = [];
  parts.push(`Today: ${today}`);
  parts.push(`User request: "${userRequest}"`);
  if (mode !== 'new' && current) {
    parts.push(`Current type: ${current.creationType}`);
    parts.push(`Mode: ${mode} (user wants to ${mode} the existing creation)`);
  }
  parts.push(`\nAvailable types:${typeDescriptions}`);
  parts.push(`\nReturn ONLY valid JSON (no markdown, no explanation):`);
  parts.push(`{ "creationType": "<best_type>", "keyRequirements": ["req1", "req2", "req3"], "tone": "practical|fun|professional", "isModification": ${mode !== 'new'} }`);

  return parts.join('\n');
}

/**
 * Step 3+4: Content Spec + Builder
 * Full system-prompted content generation with intent context injected.
 */
function buildSystemPrompt(today: string): string {
  return `You are PocketVibe, an AI that turns everyday ideas into useful tools and mini-applications. You help normal people — not developers — create things they can actually use right now.

Output ONLY a valid JSON object. No markdown fences, no explanation, no extra text outside the JSON.

Use this exact structure:
{
  "title": "Short friendly title (max 60 chars)",
  "creationType": "one of the supported types listed below",
  "description": "One sentence describing what this is",
  "summary": "1-2 warm friendly sentences for the user",
  "content": { ...type-specific fields... }
}

SUPPORTED CREATION TYPES:
checklist, habit_tracker, budget_calculator, savings_tracker, landing_page,
event_planner, meal_planner, workout_tracker, price_calculator, task_planner

CONTENT FORMATS:
checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }
habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }
budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000}],"notes":"" }
savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }
landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do","description":"About paragraph","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }
event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task","dueDate":"","done":false}],"guestCount":0,"notes":"" }
meal_planner: { "type":"meal_planner","weekLabel":"This week","meals":[{"id":"m1","day":"Monday","slot":"dinner","name":"Meal name"}],"groceryList":["Ingredient 1"] }
workout_tracker: { "type":"workout_tracker","planName":"My Workout Plan","days":[{"id":"d1","label":"Day 1","exercises":[{"id":"e1","name":"Push-ups","sets":3,"reps":"15"}],"completed":false}] }
price_calculator: { "type":"price_calculator","title":"Service Quote","currency":"R","description":"Quote for services","lineItems":[{"id":"li1","label":"Service name","quantity":1,"unitPrice":500,"category":"Services"},{"id":"li2","label":"Additional item","quantity":2,"unitPrice":150,"category":"Materials"}],"taxRate":15,"notes":"" }
task_planner: { "type":"task_planner","planTitle":"My Plan","sections":[{"id":"sec1","title":"This week","tasks":[{"id":"t1","label":"Task","priority":"medium","done":false,"dueDate":""}]}] }

RULES:
- Use practical realistic defaults, not fake values
- All labels must be plain friendly English — no technical jargon
- Make it immediately useful
- Currency: use "R" (ZAR) by default unless the user specifies another
- For improve/add requests: preserve all existing data, only change or add what was asked
- Today's date is ${today}
- Do not hardcode a specific location unless the user mentions one
- Always make something USEFUL and functional, not decorative
- IMPORTANT: For improve/add, you MUST visibly change the content from what was provided — do not return the same data
- If the user asks for a website or landing page, use landing_page
- If the user asks for an app or tool, pick the closest structured type
- Never return raw HTML — always use a structured creationType from the list above`;
}

function buildBuilderMessage(body: Record<string, unknown>, intent: Record<string, unknown>): string {
  const parts: string[] = [];
  const mode = (body.mode as string) ?? 'new';
  const userRequest = body.userRequest as string;
  const current = body.currentCreation as Record<string, unknown> | undefined;
  const keyRequirements = (intent.keyRequirements as string[] ?? []).join(', ');
  const creationType = intent.creationType as string;

  parts.push(`INTENT ANALYSIS: Use type="${creationType}". Key requirements: ${keyRequirements || userRequest}.`);
  parts.push('');

  if (mode === 'new' || !current) {
    parts.push(`User request: ${userRequest}`);
  } else if (mode === 'improve') {
    parts.push('The user wants to improve an existing creation.');
    parts.push(`Improvement request: ${userRequest}`);
    parts.push(`Current title: ${current.title}`);
    parts.push(`Current type: ${current.creationType}`);
    parts.push(`Original request: ${current.originalRequest ?? ''}`);
    parts.push(`Current content:\n${JSON.stringify(current.content, null, 2)}`);
    parts.push('Instructions: Apply the improvement. Keep the same creationType. Preserve all existing data not mentioned. You MUST return content that visibly differs from what was provided.');
  } else if (mode === 'add') {
    parts.push('The user wants to add to an existing creation.');
    parts.push(`Addition request: ${userRequest}`);
    parts.push(`Current title: ${current.title}`);
    parts.push(`Current type: ${current.creationType}`);
    parts.push(`Current content:\n${JSON.stringify(current.content, null, 2)}`);
    parts.push('Instructions: Add what the user requested. Keep all existing data. Only append new items. You MUST return content that is different from what was provided.');
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
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
      status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const userRequest = body.userRequest as string | undefined;
  if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'userRequest is required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (userRequest.length > 2000) {
    return new Response(JSON.stringify({ error: 'userRequest too long (max 2000 chars)' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const locale = body.locale as Record<string, string> | undefined;
  const today = locale?.date ?? new Date().toISOString().slice(0, 10);
  const mode = (body.mode as string) ?? 'new';
  const currentCreation = body.currentCreation as Record<string, unknown> | undefined;
  const oldContent = (currentCreation?.content as Record<string, unknown> | undefined) ?? null;
  const oldSig = oldContent ? getVisibleSignature(oldContent) : null;

  const genAI = new GoogleGenerativeAI(geminiKey);

  // ── Step 1+2: Intent Analysis + Template Selector ─────────────────────────
  // Uses a lightweight prompt to extract type and requirements before building.
  const intentModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  let intent: Record<string, unknown> = {
    creationType: currentCreation?.creationType ?? 'checklist',
    keyRequirements: [userRequest],
    tone: 'practical',
    isModification: mode !== 'new',
  };
  try {
    const intentResult = await intentModel.generateContent(buildIntentPrompt(body, today));
    const intentRaw = intentResult.response.text();
    const intentParsed = parseJson(intentRaw) as Record<string, unknown>;
    // Validate the type is supported
    if (intentParsed.creationType && SUPPORTED_TYPES.includes(intentParsed.creationType as SupportedType)) {
      intent = intentParsed;
    }
  } catch {
    // Intent step failed — fall through with defaults; builder will handle it
  }

  // ── Step 3+4: Content Spec + Builder ──────────────────────────────────────
  // Main content generation with intent context injected into the user message.
  const builderModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(today),
  });

  const builderMessage = buildBuilderMessage(body, intent);
  let parsed: Record<string, unknown>;

  try {
    const result = await builderModel.generateContent(builderMessage);
    const raw = result.response.text();
    parsed = parseJson(raw) as Record<string, unknown>;
  } catch {
    // ── Step 6 (early repair): parse failure on first attempt ───────────────
    try {
      const retry = await builderModel.generateContent(
        `${builderMessage}\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation.`,
      );
      parsed = parseJson(retry.response.text()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: 'Could not generate a valid response. Please try again.' }), {
        status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Step 5: QA — visible change check for improve/add ────────────────────
  const newContent = parsed.content as Record<string, unknown> | undefined;
  let changeReport: { changed: boolean; changes: string[]; unsupported: string[] } | undefined;

  if ((mode === 'improve' || mode === 'add') && oldSig && newContent) {
    const newSig = getVisibleSignature(newContent);
    const changed = newSig !== oldSig;

    if (!changed) {
      // ── Step 6: Repair — explicit no-op warning ───────────────────────────
      try {
        const repairMsg = `${builderMessage}\n\n[QA FAILURE: Your previous response returned identical visible content. The user's request was not satisfied. You MUST return content that visibly differs from the current version. Make a real change based on: "${userRequest}"]`;
        const repairResult = await builderModel.generateContent(repairMsg);
        const repairParsed = parseJson(repairResult.response.text()) as Record<string, unknown>;
        const repairContent = repairParsed.content as Record<string, unknown> | undefined;
        if (repairContent && getVisibleSignature(repairContent) !== oldSig) {
          Object.assign(parsed, repairParsed);
          const repairedContent = parsed.content as Record<string, unknown>;
          changeReport = {
            changed: true,
            changes: describeChanges(oldContent!, repairedContent),
            unsupported: [],
          };
        } else {
          changeReport = { changed: false, changes: [], unsupported: ['No visible change could be made'] };
        }
      } catch {
        changeReport = { changed: false, changes: [], unsupported: ['Repair attempt failed'] };
      }
    } else {
      changeReport = {
        changed: true,
        changes: describeChanges(oldContent!, newContent),
        unsupported: [],
      };
    }
  }

  // ── Step 7: Final response assembly ──────────────────────────────────────
  const responseBody = changeReport ? { ...parsed, changeReport } : parsed;

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});


import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Rate limiting ──────────────────────────────────────────────────────────────
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

// ── Visible signature (mirrors src/lib/visibleSignature.ts) ───────────────────
// Deno functions cannot import client-side modules, so we duplicate the logic.
function getVisibleSignature(content: Record<string, unknown>): string {
  const type = content.type as string;
  if (type === 'habit_tracker') {
    const habits = (content.habits as Array<{name:string;icon:string;frequency:string}> ?? []);
    return JSON.stringify({
      habits: habits.map(h => ({ name: h.name, icon: h.icon, frequency: h.frequency })),
      startDate: content.startDate,
    });
  }
  if (type === 'checklist') {
    const sections = (content.sections as Array<{title:string;items:Array<{label:string;checked:boolean}>}> ?? []);
    return JSON.stringify({
      sections: sections.map(s => ({
        title: s.title,
        items: s.items.map(i => ({ label: i.label, checked: i.checked })),
      })),
    });
  }
  if (type === 'budget_calculator') {
    return JSON.stringify({
      currency: content.currency,
      income: (content.income as Array<{label:string;amount:number}> ?? []).map(l => ({ label: l.label, amount: l.amount })),
      expenses: (content.expenses as Array<{label:string;amount:number}> ?? []).map(l => ({ label: l.label, amount: l.amount })),
    });
  }
  if (type === 'savings_tracker') {
    return JSON.stringify({
      goalName: content.goalName,
      targetAmount: content.targetAmount,
      currentAmount: content.currentAmount,
    });
  }
  if (type === 'landing_page') {
    return JSON.stringify({
      businessName: content.businessName,
      tagline: content.tagline,
      description: content.description,
      featureTitles: (content.features as Array<{title:string}> ?? []).map(f => f.title),
    });
  }
  return JSON.stringify(content);
}

// ── Diff helpers ──────────────────────────────────────────────────────────────
function describeChanges(oldContent: Record<string, unknown>, newContent: Record<string, unknown>): string[] {
  const changes: string[] = [];
  const type = newContent.type as string;

  if (type === 'habit_tracker') {
    const oldHabits = (oldContent.habits as Array<{name:string}> ?? []).map(h => h.name);
    const newHabits = (newContent.habits as Array<{name:string}> ?? []).map(h => h.name);
    const added = newHabits.filter(n => !oldHabits.includes(n));
    const removed = oldHabits.filter(n => !newHabits.includes(n));
    if (added.length) changes.push(`Added habits: ${added.join(', ')}`);
    if (removed.length) changes.push(`Removed habits: ${removed.join(', ')}`);
    if (oldContent.startDate !== newContent.startDate) changes.push('Updated start date');
    if (!added.length && !removed.length) changes.push('Updated habit details');
  } else if (type === 'checklist') {
    const oldCount = (oldContent.sections as Array<{items:unknown[]}> ?? []).reduce((n, s) => n + s.items.length, 0);
    const newCount = (newContent.sections as Array<{items:unknown[]}> ?? []).reduce((n, s) => n + s.items.length, 0);
    if (newCount > oldCount) changes.push(`Added ${newCount - oldCount} item(s)`);
    else if (newCount < oldCount) changes.push(`Removed ${oldCount - newCount} item(s)`);
    else changes.push('Updated checklist items');
  } else {
    changes.push('Updated content');
  }
  return changes;
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
  "summary": "1-2 warm friendly sentences for the user",
  "content": { ...type-specific fields... }
}

SUPPORTED CREATION TYPES:
checklist, habit_tracker, budget_calculator, savings_tracker, landing_page,
event_planner, meal_planner, workout_tracker, survey_form, task_planner

CONTENT FORMATS:
checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }
habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }
budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000}],"notes":"" }
savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }
landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do","description":"About paragraph","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }
event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task","dueDate":"","done":false}],"guestCount":0,"notes":"" }
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
- Always make something USEFUL and functional, not decorative
- IMPORTANT: For improve/add, you MUST visibly change the content from what was provided — do not return the same data
- If the user asks for a website or landing page, use landing_page
- If the user asks for an app or tool, pick the closest structured type
- Never return raw HTML — always use a structured creationType from the list above`;
}

function buildUserMessage(body: Record<string, unknown>): string {
  const parts: string[] = [];
  const mode = body.mode as string ?? 'new';
  const userRequest = body.userRequest as string;
  const current = body.currentCreation as Record<string, unknown> | undefined;

  if (mode === 'new' || !current) {
    parts.push(`User request: ${userRequest}`);
  } else if (mode === 'improve') {
    parts.push('The user wants to improve an existing creation.');
    parts.push(`Improvement request: ${userRequest}`);
    parts.push(`Current title: ${current.title}`);
    parts.push(`Current type: ${current.creationType}`);
    parts.push(`Original request: ${current.originalRequest ?? ''}`);
    parts.push(`Current content:\n${JSON.stringify(current.content, null, 2)}`);
    parts.push('Instructions: Apply the improvement. Keep the same creationType unless the user explicitly asks to change it. Preserve all existing data not mentioned. You MUST return content that visibly differs from what was provided.');
  } else if (mode === 'add') {
    parts.push('The user wants to add to an existing creation.');
    parts.push(`Addition request: ${userRequest}`);
    parts.push(`Current title: ${current.title}`);
    parts.push(`Current type: ${current.creationType}`);
    parts.push(`Current content:\n${JSON.stringify(current.content, null, 2)}`);
    parts.push('Instructions: Add what the user requested. Keep all existing data. Only append new items. You MUST return content that is different from what was provided.');
  } else {
    parts.push(`User request: ${userRequest}`);
  }
  return parts.join('\n');
}

// ── JSON parse with fence stripping ──────────────────────────────────────────
function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
      status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const userRequest = body.userRequest as string | undefined;
  if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'userRequest is required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (userRequest.length > 2000) {
    return new Response(JSON.stringify({ error: 'userRequest too long (max 2000 chars)' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const locale = body.locale as Record<string, string> | undefined;
  const today = locale?.date ?? new Date().toISOString().slice(0, 10);
  const mode = (body.mode as string) ?? 'new';
  const currentCreation = body.currentCreation as Record<string, unknown> | undefined;
  const oldContent = (currentCreation?.content as Record<string, unknown> | undefined) ?? null;
  const oldSig = oldContent ? getVisibleSignature(oldContent) : null;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(today),
  });

  // ── Step 1: Intent + Build ─────────────────────────────────────────────────
  const userMessage = buildUserMessage(body);

  let parsed: Record<string, unknown>;
  try {
    const result = await model.generateContent(userMessage);
    const raw = result.response.text();
    parsed = parseJson(raw) as Record<string, unknown>;
  } catch {
    // One repair attempt on parse failure
    try {
      const retry = await model.generateContent(
        `${userMessage}\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation.`,
      );
      parsed = parseJson(retry.response.text()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: 'Could not generate a valid response. Please try again.' }), {
        status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Step 2: QA — visible change check for improve/add ────────────────────
  const newContent = parsed.content as Record<string, unknown> | undefined;
  let changeReport: { changed: boolean; changes: string[]; unsupported: string[] } | undefined;

  if ((mode === 'improve' || mode === 'add') && oldSig && newContent) {
    const newSig = getVisibleSignature(newContent);
    const changed = newSig !== oldSig;

    if (!changed) {
      // ── Step 3: Repair — one more attempt with explicit no-op warning ───
      try {
        const repairMsg = `${userMessage}\n\n[QA FAILURE: Your previous response returned identical visible content. The user's request was not satisfied. You MUST return content that visibly differs from the current version. Make a real change.]`;
        const repairResult = await model.generateContent(repairMsg);
        const repairParsed = parseJson(repairResult.response.text()) as Record<string, unknown>;
        const repairContent = repairParsed.content as Record<string, unknown> | undefined;
        if (repairContent && getVisibleSignature(repairContent) !== oldSig) {
          // Repair worked — use repaired result
          Object.assign(parsed, repairParsed);
          const repairedContent = parsed.content as Record<string, unknown>;
          changeReport = {
            changed: true,
            changes: describeChanges(oldContent!, repairedContent),
            unsupported: [],
          };
        } else {
          // Still no change after repair — flag it
          changeReport = { changed: false, changes: [], unsupported: ['No visible change could be made'] };
        }
      } catch {
        changeReport = { changed: false, changes: [], unsupported: ['Repair attempt failed'] };
      }
    } else {
      changeReport = {
        changed: true,
        changes: describeChanges(oldContent!, newContent),
        unsupported: [],
      };
    }
  }

  // ── Step 4: Final response with change report ─────────────────────────────
  const responseBody = changeReport ? { ...parsed, changeReport } : parsed;

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
