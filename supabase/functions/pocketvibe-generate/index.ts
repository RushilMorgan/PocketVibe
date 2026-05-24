// Supabase Edge Function — pocketvibe-generate
// Intent -> Build -> QA -> Repair -> Final response pipeline
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
