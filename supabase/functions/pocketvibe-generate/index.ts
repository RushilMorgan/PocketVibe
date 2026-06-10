// Supabase Edge Function — pocketvibe-generate
// Pipeline: Intent → UX Designer → Builder → Validation → QA → Repair → Final
// Deploy: supabase functions deploy pocketvibe-generate
// Secret: supabase secrets set GEMINI_API_KEY=your-key

// @ts-nocheck — Deno runtime file; VS Code TS errors here are false positives.
// deno-lint-ignore-file
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-pv-user-token',
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

// ── Daily quota config ─────────────────────────────────────────────────────────
// Single source of truth for usage limits. Adding a paid tier later is just a new
// entry here plus returning it from resolveTier(). Two budgets are tracked:
//   generation = new / improve / add (the expensive full pipeline)
//   chat       = the lighter Q&A path
// Tune these numbers freely — they take effect on the next function deploy.
type QuotaTier = 'anonymous' | 'free' | 'pro';
type QuotaKind = 'generation' | 'chat';

const QUOTAS: Record<QuotaTier, Record<QuotaKind, number>> = {
  anonymous: { generation: 3,   chat: 5 },
  free:      { generation: 15,  chat: 40 },
  pro:       { generation: 200, chat: 1000 },
};

/**
 * Resolve a user's tier. Today: signed-in = 'free', anonymous = 'anonymous'.
 * PAID SEAM: when subscriptions land, look up the user's plan here and return
 * 'pro' for active subscribers — nothing else in the pipeline needs to change.
 */
function resolveTier(userId: string | null): QuotaTier {
  if (!userId) return 'anonymous';
  return 'free';
}

/** Next UTC midnight as an ISO string — when the daily counters reset. */
function nextResetIso(): string {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return reset.toISOString();
}

interface Identity {
  identifier: string;        // user UUID, or 'ip:1.2.3.4'
  identifierType: 'user' | 'ip';
  tier: QuotaTier;
}

/**
 * Identify the caller. A verified Supabase user token (sent in x-pv-user-token)
 * wins; otherwise we fall back to the client IP. The token is VERIFIED via the
 * admin client, so a user can't spoof someone else's id to drain their quota.
 */
async function getIdentity(req: Request, supabaseAdmin: unknown): Promise<Identity> {
  const token = req.headers.get('x-pv-user-token');
  if (token && supabaseAdmin) {
    try {
      const { data } = await (supabaseAdmin as any).auth.getUser(token);
      if (data?.user?.id) {
        return { identifier: data.user.id, identifierType: 'user', tier: resolveTier(data.user.id) };
      }
    } catch { /* fall through to IP */ }
  }
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  return { identifier: `ip:${ip}`, identifierType: 'ip', tier: 'anonymous' };
}

interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: QuotaTier;
  kind: QuotaKind;
  resetsAt: string;
  degraded?: boolean;
}

/**
 * Atomically check + increment the daily counter for this identity & kind.
 * Fails OPEN on a DB error (allows the request): the per-minute burst limiter
 * and the Google billing cap remain as backstops, so a transient DB blip should
 * not block legitimate users.
 */
async function enforceQuota(
  supabaseAdmin: unknown,
  identity: Identity,
  kind: QuotaKind,
): Promise<QuotaResult> {
  const limit = QUOTAS[identity.tier][kind];
  const resetsAt = nextResetIso();

  if (!supabaseAdmin) {
    // No DB configured (e.g. local dev without service role) — don't block.
    return { allowed: true, used: 0, limit, remaining: limit, tier: identity.tier, kind, resetsAt, degraded: true };
  }

  try {
    const { data, error } = await (supabaseAdmin as any).rpc('increment_daily_usage', {
      p_identifier: identity.identifier,
      p_identifier_type: identity.identifierType,
      p_kind: kind,
      p_limit: limit,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const used = row?.used ?? 0;
    return {
      allowed: Boolean(row?.allowed),
      used,
      limit,
      remaining: Math.max(0, limit - used),
      tier: identity.tier,
      kind,
      resetsAt,
    };
  } catch (e) {
    console.error('[quota] increment_daily_usage failed (failing open):', e);
    return { allowed: true, used: 0, limit, remaining: limit, tier: identity.tier, kind, resetsAt, degraded: true };
  }
}

/** Shape attached to successful responses so the client can show remaining counts. */
function usagePayload(r: QuotaResult) {
  return { kind: r.kind, used: r.used, limit: r.limit, remaining: r.remaining, tier: r.tier, resetsAt: r.resetsAt };
}

/** 429 body the client recognises as a quota stop (distinct from the burst limiter). */
function quotaExceededResponse(r: QuotaResult): Response {
  return new Response(JSON.stringify({
    error: 'quota_exceeded',
    kind: r.kind,
    used: r.used,
    limit: r.limit,
    remaining: 0,
    tier: r.tier,
    resetsAt: r.resetsAt,
  }), { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// ── User memory ───────────────────────────────────────────────────────────────
// Fetches the user's Toolie profile and assembles a compact (<150 token) memory
// string. Injected into every prompt so Toolie already knows the user. Fails
// silently — a DB hiccup must never block a generation.
async function getUserMemory(supabaseAdmin: unknown, userId: string): Promise<string> {
  if (!supabaseAdmin) return '';
  try {
    const { data } = await (supabaseAdmin as any)
      .from('user_profiles')
      .select('name,location,what_they_do,goals,preferences,remember_notes')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return '';
    const parts: string[] = [];
    if (data.name)           parts.push(`Name: ${data.name}`);
    if (data.location)       parts.push(`Location: ${data.location}`);
    if (data.what_they_do)   parts.push(`What I do: ${data.what_they_do}`);
    if (data.goals)          parts.push(`My goals: ${data.goals}`);
    if (data.preferences)    parts.push(`Preferences: ${data.preferences}`);
    if (data.remember_notes) parts.push(`Remember: ${data.remember_notes}`);
    return parts.length
      ? `[About this user — personalise your response using this context]\n${parts.join('\n')}`
      : '';
  } catch { return ''; }
}

// ── Supported types ────────────────────────────────────────────────────────────
const SUPPORTED_TYPES = [
  'checklist', 'habit_tracker', 'budget_calculator', 'savings_tracker',
  'landing_page', 'event_planner', 'meal_planner', 'workout_tracker',
  'price_calculator', 'task_planner', 'tournament_pool_tracker',
  'idea_thinking_board', 'recipe', 'recipe_book',
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
    if (content.challengeMode || Array.isArray(content.participants)) {
      return JSON.stringify({
        planName: content.planName,
        participants: (content.participants as Array<{name:string;emoji?:string}> ?? []).map(p => ({ name: p.name, emoji: p.emoji ?? '' })),
        activityTypes: content.activityTypes ?? [],
        weeklyTarget: content.weeklyTarget,
        scoringRules: content.scoringRules,
        logs: (content.logs as Array<{participantId:string;date:string;activityType:string;duration?:string;distance?:string;note?:string}> ?? []).map(l => ({
          participantId: l.participantId,
          date: l.date,
          activityType: l.activityType,
          duration: l.duration ?? '',
          distance: l.distance ?? '',
          note: l.note ?? '',
        })),
      });
    }
    return JSON.stringify({ planName: content.planName, days: (content.days as Array<{label:string;exercises:Array<{name:string}>}> ?? []).map(d => ({ label: d.label, exercises: d.exercises.map(e => e.name) })) });
  }
  if (type === 'task_planner') {
    return JSON.stringify({ planTitle: content.planTitle, sections: (content.sections as Array<{title:string;tasks:Array<{label:string}>}> ?? []).map(s => ({ title: s.title, tasks: s.tasks.map(t => t.label) })) });
  }
  if (type === 'tournament_pool_tracker') {
    return JSON.stringify({
      poolName: content.poolName,
      participants: (content.participants as Array<{name:string;emoji?:string}> ?? []).map(p => ({ name: p.name, emoji: p.emoji ?? '' })),
      teams: (content.teams as Array<{name:string;pot:number;status:string;assignedTo?:string}> ?? []).map(t => ({ name: t.name, pot: t.pot, status: t.status, assignedTo: t.assignedTo ?? '' })),
      matches: (content.matches as Array<{teamAId:string;teamBId:string;scoreA?:number;scoreB?:number}> ?? []).map(m => ({ teamAId: m.teamAId, teamBId: m.teamBId, scoreA: m.scoreA ?? '', scoreB: m.scoreB ?? '' })),
      drawLocked: content.drawLocked,
      scoringRules: content.scoringRules,
    });
  }
  if (type === 'idea_thinking_board') {
    return JSON.stringify({
      title: content.title,
      ideaSummary: content.ideaSummary,
      problem: content.problem,
      solution: content.solution,
      scores: content.scores,
      risks: (content.risks as Array<{title:string;severity:string;note:string}> ?? []).map(r => ({ title: r.title, severity: r.severity, note: r.note })),
      moneyIdeas: (content.moneyIdeas as Array<{model:string;note:string;confidence:number}> ?? []).map(m => ({ model: m.model, note: m.note, confidence: m.confidence })),
      nextSteps: (content.nextSteps as Array<{label:string;done:boolean}> ?? []).map(s => ({ label: s.label, done: s.done })),
      notes: content.notes ?? '',
    });
  }
  if (type === 'recipe') {
    return JSON.stringify({
      title: content.title,
      servings: content.servings ?? 0,
      prepTime: content.prepTime ?? '',
      cookTime: content.cookTime ?? '',
      ingredients: (content.ingredients as Array<{name:string;quantity?:string;unit?:string}> ?? []).map(i => ({ name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '' })),
      steps: (content.steps as Array<{text:string;time?:string}> ?? []).map(s => ({ text: s.text, time: s.time ?? '' })),
      notes: content.notes ?? '',
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

// ── YouTube URL extraction (for recipe video ingestion) ──────────────────────
function extractYouTubeUrl(text: string): string | null {
  const m = text.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:shorts\/|watch\?[^\s]*v=|live\/)|youtu\.be\/)[\w-]+[^\s]*/i,
  );
  return m ? m[0] : null;
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
- task_planner: project management, work tasks, weekly or daily planning
- tournament_pool_tracker: private family/friend/office tournament pools and draws, World Cup sweepstakes, team draws with seeded pots
- idea_thinking_board: brainstorming or thinking through a business idea, app idea, side hustle, product, service, or creative concept — any request to explore, evaluate, structure, or improve an idea
- recipe: extracting or structuring a cooking recipe (often from a YouTube/TikTok/Instagram cooking video link) — ingredients, quantities, and step-by-step method
- recipe_book: a personal cookbook that holds many recipes with the user's dietary/serving preferences — only when the user explicitly asks for a cookbook or recipe collection`;

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
 * Step 3: UI/UX Designer Agent
 * Converts the intent into a mobile-first UX plan before anything is built.
 * Rules:
 *   - User must never guess what to tap
 *   - Daily action must be above the fold
 *   - Every editable field needs an obvious control
 *   - Prefer cards, chips, progress bars — never tiny tables
 *   - Plain human language only
 */
function buildUxDesignerPrompt(
  intent: Record<string, unknown>,
  body: Record<string, unknown>,
  today: string,
): string {
  const userRequest = body.userRequest as string;
  const mode = (body.mode as string) ?? 'new';
  const creationType = intent.creationType as string;
  const keyRequirements = (intent.keyRequirements as string[] ?? []).join(', ');
  const tone = (intent.tone as string) ?? 'practical';

  return [
    'You are a mobile UX designer. Your tools are used by everyday people on a phone, not by developers.',
    '',
    'Design rules you must follow:',
    '- Every important action must be visible without hunting — no hidden menus or swipe gestures',
    '- If the tool is meant for daily use, the primary action must be reachable without scrolling',
    '- If the user may want to change names, targets, rules, or settings later, an Edit button is required',
    '- Avoid tiny tables on mobile — use cards, chips, progress bars, and clear labelled buttons',
    '- All labels must be plain human language — never use words like config, payload, schema, or render',
    '- The empty state must be welcoming and tell the user exactly what to tap first',
    '- If multiple people share the tool, each person must be identifiable',
    '- If scoring or calculation rules exist, they must be editable and their effect must be visible immediately',
    '',
    `Today: ${today}`,
    `User request: "${userRequest}"`,
    `Resolved type: ${creationType}`,
    `Key requirements: ${keyRequirements || userRequest}`,
    `Tone: ${tone}`,
    `Mode: ${mode}`,
    '',
    'Return ONLY valid JSON (no markdown fences, no explanation):',
    '{',
    '  "primaryAction": "The single most common thing the user taps (e.g. Log today, Add expense, Check off item)",',
    '  "secondaryActions": ["other common actions in priority order"],',
    '  "aboveFold": ["what the user sees first without scrolling — list 2-4 items"],',
    '  "editControls": ["every field or rule the user might want to rename or change later"],',
    '  "emptyState": "Friendly short message shown when there is no data yet",',
    '  "dailyUseFlow": "One sentence describing the daily interaction: open → tap X → see Y",',
    '  "trustRisks": ["things that could confuse or mislead the user"],',
    '  "requiredFields": ["content field names that must exist in the data to support this UX"],',
    '  "labels": { "primaryButton": "short label", "editButton": "short label", "emptyTitle": "short title" }',
    '}',
  ].join('\n');
}

/**
 * Step 4+5: Content Spec + Builder
 * Full system-prompted content generation with intent + UX plan injected.
 */
function buildSystemPrompt(today: string, userMemory = ''): string {
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
event_planner, meal_planner, workout_tracker, price_calculator, task_planner, tournament_pool_tracker,
idea_thinking_board, recipe, recipe_book

CONTENT FORMATS:
checklist: { "type":"checklist","sections":[{"id":"s1","title":"Section Name","items":[{"id":"i1","label":"Item","checked":false}]}] }
habit_tracker: { "type":"habit_tracker","habits":[{"id":"h1","name":"Habit name","icon":"🏃","frequency":"daily","completions":{}}],"startDate":"${today}" }
budget_calculator: { "type":"budget_calculator","currency":"R","income":[{"id":"inc1","label":"Monthly salary","amount":20000}],"expenses":[{"id":"exp1","label":"Rent","category":"Housing","amount":5000}],"notes":"" }
savings_tracker: { "type":"savings_tracker","goalName":"Holiday Fund","targetAmount":10000,"currentAmount":0,"currency":"R","deadline":"","contributions":[] }
landing_page: { "type":"landing_page","businessName":"Business Name","tagline":"What you do","description":"About paragraph","features":[{"icon":"⭐","title":"Feature","description":"What this offers"}],"ctaLabel":"Get in touch","ctaUrl":"","contactEmail":"" }
event_planner: { "type":"event_planner","eventName":"Event Name","eventDate":"","tasks":[{"id":"t1","label":"Task","dueDate":"","done":false}],"guestCount":0,"notes":"" }
meal_planner: { "type":"meal_planner","weekLabel":"This week","meals":[{"id":"m1","day":"Monday","slot":"dinner","name":"Meal name"}],"groceryList":["Ingredient 1"] }
recipe: { "type":"recipe","title":"Dish Name","sourceUrl":"","thumbnailUrl":"","servings":2,"prepTime":"10 min","cookTime":"20 min","ingredients":[{"id":"ing1","name":"Flour","quantity":"1","unit":"cup","have":false,"emoji":"🌾"}],"steps":[{"id":"st1","number":1,"text":"Do this first.","time":"5 min","emoji":"🔥"}],"extraShoppingItems":[],"notes":"","tags":["quick"],"layoutMode":"card" }
recipe_book: { "type":"recipe_book","title":"My Cookbook","preferences":{"dietary":"none","servings":2,"units":"metric","likes":"","avoids":""},"recipes":[] }
workout_tracker (challenge mode): { "type":"workout_tracker","planName":"Partner Challenge","challengeMode":true,"participants":[{"id":"p1","name":"Alice","emoji":"🏃"},{"id":"p2","name":"Bob","emoji":"🚶"}],"activityTypes":["walk","run","gym","other"],"weeklyTarget":3,"logs":[],"scoringRules":{"pointsPerActivity":10,"weeklyTargetBonus":20,"runningBonus":5} }
workout_tracker (basic plan): { "type":"workout_tracker","planName":"My Workout Plan","days":[{"id":"d1","label":"Day 1","exercises":[{"id":"e1","name":"Push-ups","sets":3,"reps":"15"}],"completed":false}] }
price_calculator: { "type":"price_calculator","title":"Service Quote","currency":"R","description":"Quote for services","lineItems":[{"id":"li1","label":"Service name","quantity":1,"unitPrice":500,"category":"Services"},{"id":"li2","label":"Additional item","quantity":2,"unitPrice":150,"category":"Materials"}],"taxRate":15,"notes":"" }
task_planner: { "type":"task_planner","planTitle":"My Plan","sections":[{"id":"sec1","title":"This week","tasks":[{"id":"t1","label":"Task","priority":"medium","done":false,"dueDate":""}]}] }
idea_thinking_board: { "type":"idea_thinking_board","title":"Idea Title","ideaSummary":"A 2-3 sentence summary of what the idea is.","problem":"The specific problem this solves.","solution":"How this idea solves the problem.","whyNow":"Why this is the right moment.","targetUsers":[{"id":"u1","name":"Young professionals","need":"A faster way to X","whyTheyCare":"They currently waste time on Y"},{"id":"u2","name":"Small business owners","need":"Affordable solution for Z","whyTheyCare":"Existing tools cost too much"}],"risks":[{"id":"r1","title":"People already use WhatsApp groups for this","severity":"medium","impact":"low","note":"The free and familiar alternative is hard to beat without a strong value add."},{"id":"r2","title":"Hard to get first users","severity":"high","impact":"medium","note":"Without an existing network, early traction will be slow."}],"opportunities":[{"id":"o1","title":"No good mobile-first option exists","note":"Most competitors are desktop-only."}],"moneyIdeas":[{"id":"m1","model":"Monthly subscription","note":"Charge R99/month for premium features. Free tier to get users in.","confidence":7},{"id":"m2","model":"Once-off purchase","note":"Sell a one-time licence for R499. Simpler, no recurring billing needed.","confidence":5}],"scores":{"clarity":7,"usefulness":8,"easeToBuild":5,"moneyPotential":6,"riskLevel":6,"confidence":7},"nextSteps":[{"id":"ns1","label":"Talk to 5 people who might use this","done":false},{"id":"ns2","label":"Build a simple demo in a weekend","done":false},{"id":"ns3","label":"Post about it and see who responds","done":false}],"visualMap":{"center":"Your Idea","branches":[{"id":"b1","label":"Problem","items":["Who suffers","How bad is it","Current workarounds"]},{"id":"b2","label":"Users","items":["Main user type","Secondary users","Who pays"]},{"id":"b3","label":"Solution","items":["Core feature","What makes it different","Simplest version"]},{"id":"b4","label":"Money","items":["Main revenue model","Price point","Who pays"]},{"id":"b5","label":"Risks","items":["Biggest threat","Hardest part","What could fail"]},{"id":"b6","label":"Next steps","items":["Test this week","Build first","Validate before building"]}]},"notes":"" }
tournament_pool_tracker: { "type":"tournament_pool_tracker","poolName":"World Cup Family Pool","tournamentName":"FIFA World Cup 2026","prizeNote":"Winner gets bragging rights!","adminName":"You","rulesNote":"Each person draws one team from each pot","participants":[{"id":"p1","name":"Alice","emoji":"⭐"},{"id":"p2","name":"Bob","emoji":"🎯"},{"id":"p3","name":"Carol","emoji":"🌟"},{"id":"p4","name":"Dave","emoji":"⚡"}],"teams":[{"id":"t1","name":"Brazil","pot":1,"group":"D","flagEmoji":"🇧🇷","status":"active"},{"id":"t2","name":"France","pot":1,"group":"A","flagEmoji":"🇫🇷","status":"active"},{"id":"t3","name":"Argentina","pot":1,"group":"C","flagEmoji":"🇦🇷","status":"active"},{"id":"t4","name":"England","pot":1,"group":"B","flagEmoji":"🏴","status":"active"},{"id":"t5","name":"Netherlands","pot":2,"group":"E","flagEmoji":"🇳🇱","status":"active"},{"id":"t6","name":"Portugal","pot":2,"group":"H","flagEmoji":"🇵🇹","status":"active"},{"id":"t7","name":"Belgium","pot":2,"group":"F","flagEmoji":"🇧🇪","status":"active"},{"id":"t8","name":"Spain","pot":2,"group":"G","flagEmoji":"🇪🇸","status":"active"}],"matches":[],"drawLocked":false,"scoringRules":{"pointsPerWin":3,"pointsPerDraw":1,"knockoutBonus":5,"quarterFinalBonus":10,"semiFinalBonus":15,"finalBonus":20,"winnerBonus":50} }

${userMemory ? `${userMemory}\nUse their name, location, and goals to make this genuinely personal — localise currency, examples, and context to them.\n\n` : ''}RULES:
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
- Never return raw HTML — always use a structured creationType from the list above
- If the user mentions World Cup, tournament pool, sweepstake, seeded pots, or team draw, use tournament_pool_tracker
- For tournament_pool_tracker: never use gambling language; use friendly draw, private pool, prize note. Do not collect money.
- For recipe: write beginner-friendly numbered steps with no assumed knowledge; keep ingredient quantities as plain text (e.g. "1/2 cup", "a pinch"); set every ingredient have=false; leave extraShoppingItems and notes empty; set layoutMode to "card"; give each ingredient and each step a single fitting emoji in its "emoji" field. If a video URL is provided, use it to identify the dish and method and put it in sourceUrl.
- For recipe_book: NEVER change the creation type of an existing cookbook and NEVER drop or rewrite its "recipes" array — copy it through unchanged unless the user explicitly asked to change a specific recipe.
- For idea_thinking_board: read the user's prompt carefully — the INTENT changes everything.
  * If the prompt starts with "I want to understand and explore" → this is a LEARNING board. Fill fields as: ideaSummary=overview of the topic, problem=the question being explored, solution=the clearest current answer/approach, targetUsers=who this topic is most relevant for, risks=hard truths/misconceptions/pitfalls, moneyIdeas=ways to apply this knowledge (model=application, note=how), nextSteps=what to learn/do first, visualMap=key concepts and how they relate.
  * If the prompt starts with "I want to compare" → this is a COMPARISON board. Fill fields as: ideaSummary=what is being compared, problem=the decision/question at hand, solution=the high-level recommendation, targetUsers=personas who'd choose each option, risks=where each option falls short, moneyIdeas=use cases for each option (model=option name, note=when to use it), nextSteps=how to decide/validate.
  * If the prompt starts with "I want to brainstorm" → this is a BRAINSTORM board. Be expansive and creative. Fill fields generously with possibilities, connections, and diverse angles.
  * If the prompt starts with "I need to think through a decision" → this is a DECISION board. Be honest and personal. Focus on trade-offs, unknowns, and helping the user commit.
  * For all non-business intents: DO NOT force money/revenue framing. Adapt moneyIdeas to "ways to apply/use this" and scores to reflect clarity, usefulness, and confidence — not commercial viability.
  * For business/validate intent (default): every section must reference the user's ACTUAL idea by name and detail. targetUsers (3-4): each a real persona. risks (3-4): HONEST hard truths naming real competitors. moneyIdeas (3): realistic models with SPECIFIC price points in Rands (e.g. "R49/month"). nextSteps (3-5): doable-this-week actions to test cheaply BEFORE building.
  * All intents: plain friendly language. Never use "market validation", "go-to-market", or "customer segmentation". Always include all required fields (ideaSummary, problem, solution, targetUsers, risks, opportunities, moneyIdeas, scores, nextSteps, visualMap). Scores must be honest 1-10 integers.
  * Each risk must include "impact": "low"|"medium"|"high" — how much upside/reward there is despite this risk. High impact risks are worth tackling; low impact ones may not be worth the effort.`;
}

function buildBuilderMessage(
  body: Record<string, unknown>,
  intent: Record<string, unknown>,
  uxPlan: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const mode = (body.mode as string) ?? 'new';
  const userRequest = body.userRequest as string;
  const current = body.currentCreation as Record<string, unknown> | undefined;
  const keyRequirements = (intent.keyRequirements as string[] ?? []).join(', ');
  const creationType = intent.creationType as string;

  parts.push(`INTENT ANALYSIS: Use type="${creationType}". Key requirements: ${keyRequirements || userRequest}.`);
  parts.push('');

  // ── Inject UX plan so the Builder builds content that supports the UX ──────
  const primaryAction = uxPlan.primaryAction as string | undefined;
  const aboveFold = (uxPlan.aboveFold as string[] | undefined) ?? [];
  const editControls = (uxPlan.editControls as string[] | undefined) ?? [];
  const requiredFields = (uxPlan.requiredFields as string[] | undefined) ?? [];
  const dailyUseFlow = uxPlan.dailyUseFlow as string | undefined;
  const emptyState = uxPlan.emptyState as string | undefined;
  const trustRisks = (uxPlan.trustRisks as string[] | undefined) ?? [];

  if (primaryAction || editControls.length > 0 || requiredFields.length > 0) {
    parts.push('UX DESIGN REQUIREMENTS — build content that directly supports this UX:');
    if (primaryAction) parts.push(`  Primary user action: ${primaryAction}`);
    if (aboveFold.length) parts.push(`  Above the fold: ${aboveFold.join(', ')}`);
    if (editControls.length) parts.push(`  Edit controls required: ${editControls.join(', ')}`);
    if (requiredFields.length) parts.push(`  Required content fields: ${requiredFields.join(', ')}`);
    if (dailyUseFlow) parts.push(`  Daily use flow: ${dailyUseFlow}`);
    if (emptyState) parts.push(`  Empty state: "${emptyState}"`);
    if (trustRisks.length) parts.push(`  Trust risks to avoid: ${trustRisks.join('; ')}`);
    parts.push('  Include ALL required fields. If edit controls need participant names, add a participants array. If scoring rules must be editable, add a scoringRules field. Match the schema to the user needs.');
    parts.push('');
  }

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

// ── Chat prompt builder ───────────────────────────────────────────────────────
/**
 * Builds a context-aware system + user prompt for mode:'chat'.
 * The AI answers factual questions from tool data, or responds
 * with exactly "ACTION:MODIFY" when the user wants to change something.
 */
// Scoped element-edit prompt for the Idea Board "tap-to-talk" pattern.
// Mirrors buildElementEditPrompt in src/services/aiService.ts — keep in sync.
function buildElementEditPrompt(
  elementKind: string,
  element: unknown,
  instruction: string,
  content: Record<string, unknown>,
  userMemory = '',
): string {
  const isScalar = ['summary', 'problem', 'solution'].includes(elementKind);
  const isScores = elementKind === 'scores';
  const shape = isScalar
    ? '{ "text": "the rewritten text" }'
    : isScores
      ? '{ "scores": { "clarity": 1-10, "usefulness": 1-10, "easeToBuild": 1-10, "moneyPotential": 1-10, "riskLevel": 1-10, "confidence": 1-10 } }'
      : '{ "element": { ...the SAME element with the same id, fields updated... }, "addNextSteps": [{ "label": "..." }] (optional), "note": "one short line" }';

  return [
    'You are Toolie, editing ONE element of a personal idea board. Be specific, honest, and helpful.',
    ...(userMemory ? [userMemory] : []),
    `The idea, for context: "${content.title ?? ''}" — ${content.ideaSummary ?? ''}`,
    `Element kind: ${elementKind}`,
    `Current element (JSON): ${JSON.stringify(element)}`,
    `The user wants: "${instruction}"`,
    '',
    'Return ONLY a JSON object (no markdown, no prose) in exactly this shape:',
    shape,
    '',
    'Rules:',
    '- Change ONLY what the user asked. Keep the same id for the element.',
    '- Plain, friendly language. No jargon like "market validation" or "go-to-market".',
    '- For money ideas, use specific Rand prices. For risks, be honest, name real alternatives.',
    '- Optionally add 1-2 follow-up next steps via addNextSteps when it genuinely helps.',
    '- Keep it concise; do not pad.',
  ].join('\n');
}

function buildChatPrompt(
  creationType: string,
  content: Record<string, unknown>,
  userMessage: string,
  today: string,
  userMemory = '',
): string {
  let dataSummary = '';

  if (creationType === 'tournament_pool_tracker') {
    const poolName     = (content.poolName as string) ?? 'Pool';
    const tournament   = (content.tournamentName as string) ?? 'Tournament';
    const drawLocked   = Boolean(content.drawLocked);
    const participants = (content.participants as Array<{ id: string; name: string; emoji?: string }>) ?? [];
    const teams        = (content.teams as Array<{ id: string; name: string; pot: number; flagEmoji?: string; assignedTo?: string; status?: string }>) ?? [];
    const matches      = (content.matches as Array<{ teamAId: string; teamBId: string; scoreA?: number; scoreB?: number }>) ?? [];
    const scoring      = content.scoringRules as Record<string, number> | undefined;

    // Points per participant from match results
    const pointsMap: Record<string, number> = {};
    for (const p of participants) pointsMap[p.id] = 0;
    const teamOwner: Record<string, string> = {};
    for (const t of teams) { if (t.assignedTo) teamOwner[t.id] = t.assignedTo; }
    for (const m of matches) {
      if (m.scoreA !== undefined && m.scoreB !== undefined) {
        for (const [teamId, ownerId] of Object.entries(teamOwner)) {
          const p = participants.find(p => p.id === ownerId || p.name === ownerId);
          if (!p) continue;
          if (teamId === m.teamAId) {
            if (m.scoreA > m.scoreB) pointsMap[p.id] = (pointsMap[p.id] ?? 0) + (scoring?.pointsPerWin ?? 3);
            else if (m.scoreA === m.scoreB) pointsMap[p.id] = (pointsMap[p.id] ?? 0) + (scoring?.pointsPerDraw ?? 1);
          } else if (teamId === m.teamBId) {
            if (m.scoreB > m.scoreA) pointsMap[p.id] = (pointsMap[p.id] ?? 0) + (scoring?.pointsPerWin ?? 3);
            else if (m.scoreB === m.scoreA) pointsMap[p.id] = (pointsMap[p.id] ?? 0) + (scoring?.pointsPerDraw ?? 1);
          }
        }
      }
    }

    const standings = participants
      .map(p => {
        const myTeams = teams.filter(t => t.assignedTo === p.id || t.assignedTo === p.name);
        return { name: p.name, emoji: p.emoji ?? '', pts: pointsMap[p.id] ?? 0, myTeams };
      })
      .sort((a, b) => b.pts - a.pts);

    const unassigned = teams.filter(t => !t.assignedTo).length;
    const lines: string[] = [
      `Pool: ${poolName} — ${tournament}`,
      `Draw: ${drawLocked ? 'Locked' : 'Not yet drawn'} | Teams not yet assigned: ${unassigned}`,
      `Participants (${participants.length}): ${participants.map(p => `${p.emoji ?? ''} ${p.name}`).join(', ')}`,
    ];
    if (standings.some(s => s.myTeams.length > 0)) {
      lines.push('Assignments & points:');
      for (const s of standings) {
        const teamStr = s.myTeams.length
          ? s.myTeams.map(t => `${t.flagEmoji ?? ''} ${t.name} (Pot ${t.pot})`).join(', ')
          : 'no teams yet';
        lines.push(`  ${s.emoji} ${s.name}: ${teamStr} — ${s.pts} pts`);
      }
    } else {
      lines.push(`Total teams: ${teams.length}`);
    }
    if (matches.length > 0) {
      lines.push(`Results entered: ${matches.length}`);
      for (const m of matches.slice(-3)) {
        const tA = teams.find(t => t.id === m.teamAId);
        const tB = teams.find(t => t.id === m.teamBId);
        if (tA && tB && m.scoreA !== undefined && m.scoreB !== undefined) {
          lines.push(`  ${tA.name} ${m.scoreA}–${m.scoreB} ${tB.name}`);
        }
      }
    } else {
      lines.push('No match results yet');
    }
    if (scoring) {
      lines.push(`Scoring: Win=${scoring.pointsPerWin}pts, Draw=${scoring.pointsPerDraw}pt, Knockout bonus=${scoring.knockoutBonus}pts, Winner bonus=${scoring.winnerBonus}pts`);
    }
    dataSummary = lines.join('\n');

  } else if (creationType === 'workout_tracker') {
    const planName      = (content.planName as string) ?? 'Challenge';
    const challengeMode = Boolean(content.challengeMode);

    if (challengeMode) {
      const participants = (content.participants as Array<{ id: string; name: string; emoji?: string }>) ?? [];
      const logs         = (content.logs as Array<{ participantId: string; date: string; activityType: string; duration?: string; distance?: string; note?: string }>) ?? [];
      const weeklyTarget = (content.weeklyTarget as number) ?? 3;
      const scoring      = content.scoringRules as Record<string, number> | undefined;

      const pointsMap:  Record<string, number> = {};
      const countMap:   Record<string, number> = {};
      for (const p of participants) { pointsMap[p.id] = 0; countMap[p.id] = 0; }
      for (const log of logs) {
        const base     = scoring?.pointsPerActivity ?? 10;
        const runBonus = log.activityType === 'run' ? (scoring?.runningBonus ?? 5) : 0;
        pointsMap[log.participantId] = (pointsMap[log.participantId] ?? 0) + base + runBonus;
        countMap[log.participantId]  = (countMap[log.participantId]  ?? 0) + 1;
      }

      // This-week count
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekMap: Record<string, number> = {};
      for (const log of logs.filter(l => l.date >= weekKey)) {
        weekMap[log.participantId] = (weekMap[log.participantId] ?? 0) + 1;
      }

      const standings = participants
        .map(p => ({ name: p.name, emoji: p.emoji ?? '', pts: pointsMap[p.id] ?? 0, total: countMap[p.id] ?? 0, week: weekMap[p.id] ?? 0 }))
        .sort((a, b) => b.pts - a.pts);

      const lines = [
        `Challenge: ${planName}`,
        `Weekly target: ${weeklyTarget} activities`,
        `Total logs: ${logs.length}`,
        '',
        'Standings:',
        ...standings.map((s, i) => `  ${i + 1}. ${s.emoji} ${s.name} — ${s.pts} pts | ${s.total} total activities | ${s.week} this week (target: ${weeklyTarget})`),
      ];
      if (scoring) {
        lines.push(`Scoring: ${scoring.pointsPerActivity ?? 10}pts/activity, runs +${scoring.runningBonus ?? 5}pts, weekly target bonus: ${scoring.weeklyTargetBonus ?? 20}pts`);
      }
      if (logs.length > 0) {
        lines.push('Recent activity:');
        for (const log of logs.slice(-3)) {
          const p = participants.find(p => p.id === log.participantId);
          const detail = [log.distance && `${log.distance}`, log.duration && `${log.duration}`].filter(Boolean).join(', ');
          lines.push(`  ${p?.name ?? log.participantId}: ${log.activityType} on ${log.date}${detail ? ` (${detail})` : ''}`);
        }
      }
      dataSummary = lines.join('\n');
    } else {
      const days = (content.days as Array<{ label: string; completed: boolean }>) ?? [];
      const done = days.filter(d => d.completed).length;
      dataSummary = [
        `Plan: ${planName}`,
        `Progress: ${done}/${days.length} days completed`,
        `Days: ${days.map(d => `${d.label} (${d.completed ? '✓' : 'pending'})`).join('; ')}`,
      ].join('\n');
    }

  } else if (creationType === 'recipe') {
    const ings = (content.ingredients as Array<{ name: string; quantity?: string; unit?: string; have?: boolean }>) ?? [];
    const steps = (content.steps as Array<{ number?: number; text: string; time?: string }>) ?? [];
    const lines: string[] = [
      `Recipe: ${(content.title as string) ?? 'Recipe'}`,
      [content.servings ? `Serves ${content.servings}` : '', content.prepTime ? `Prep ${content.prepTime}` : '', content.cookTime ? `Cook ${content.cookTime}` : ''].filter(Boolean).join(' · '),
      `Ingredients:`,
      ...ings.map(i => `  - ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name}${i.have ? ' (have)' : ''}`),
      `Steps:`,
      ...steps.map((s, idx) => `  ${s.number ?? idx + 1}. ${s.text}${s.time ? ` (${s.time})` : ''}`),
    ];
    if (content.notes) lines.push(`Notes: ${content.notes}`);
    dataSummary = lines.join('\n');

  } else if (creationType === 'recipe_book') {
    const recipes = (content.recipes as Array<{ title: string }>) ?? [];
    const prefs = (content.preferences as Record<string, unknown>) ?? {};
    dataSummary = [
      `Cookbook: ${(content.title as string) ?? 'Cookbook'}`,
      `Preferences: ${JSON.stringify(prefs)}`,
      `Recipes (${recipes.length}): ${recipes.map(r => r.title).join(', ') || 'none yet'}`,
    ].join('\n');

  } else {
    // Generic — send a condensed JSON snapshot (first 400 chars)
    dataSummary = `Type: ${creationType}\nData: ${JSON.stringify(content).slice(0, 400)}`;
  }

  return [
    'You are Toolie, a friendly AI assistant embedded in a PocketVibe tool.',
    `Today is ${today}.`,
    ...(userMemory ? ['', userMemory] : []),
    '',
    '=== TOOL DATA ===',
    dataSummary,
    '=== END TOOL DATA ===',
    '',
    `User says: "${userMessage}"`,
    '',
    'Your job:',
    '1. If this is a QUESTION about the tool data (standings, points, who has which team, progress, how scoring works, what has been logged, etc.) — answer clearly and factually in 1-3 short sentences. Plain English, no markdown.',
    '2. If the user wants to CHANGE, ADD, UPDATE, or MODIFY the tool in any way — respond with exactly: ACTION:MODIFY',
    '   Modifications include: logging an activity, adding a result, changing scoring, running the draw, adding a person, renaming something, changing the target, etc.',
    '3. Never combine an answer with ACTION:MODIFY — it is one or the other.',
    '4. If unsure whether it is a question or a change request, answer the question.',
    '5. Keep answers short and friendly. No bullet points, no markdown.',
  ].join('\n');
}

// ── HTML safety check ─────────────────────────────────────────────────────────
const HTML_MARKERS = ['<html', '<!doctype', '<script', '<div', '</', 'onclick=', 'oninput=', 'class='];

function containsHtmlDeep(value: unknown): boolean {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return HTML_MARKERS.some(m => lower.includes(m));
  }
  if (Array.isArray(value)) return value.some(item => containsHtmlDeep(item));
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v => containsHtmlDeep(v));
  }
  return false;
}

// ── Content normalizer ────────────────────────────────────────────────────────
// Fills in required numeric sub-fields so partially-generated AI output never
// causes NaN or missing-field runtime errors in the client or in scoring logic.
// Runs server-side before validation AND before the content is stored in the DB.
function normalizeContentFields(parsed: Record<string, unknown>): void {
  const content = parsed.content as Record<string, unknown> | undefined;
  if (!content) return;
  const type = content.type as string;

  if (type === 'workout_tracker') {
    if (content.challengeMode || Array.isArray(content.participants)) {
      if (!Array.isArray(content.participants)) content.participants = [];
      if (!Array.isArray(content.logs)) content.logs = [];
      if (!Array.isArray(content.activityTypes)) content.activityTypes = ['walk', 'run', 'gym', 'other'];
      if (typeof content.weeklyTarget !== 'number') content.weeklyTarget = 3;
      const sr = (content.scoringRules ?? {}) as Record<string, unknown>;
      content.scoringRules = {
        pointsPerActivity: typeof sr.pointsPerActivity === 'number' ? sr.pointsPerActivity : 10,
        weeklyTargetBonus: typeof sr.weeklyTargetBonus === 'number' ? sr.weeklyTargetBonus : 20,
        runningBonus:      typeof sr.runningBonus      === 'number' ? sr.runningBonus      : 5,
      };
    }
  }

  if (type === 'tournament_pool_tracker') {
    if (!Array.isArray(content.participants)) content.participants = [];
    if (!Array.isArray(content.teams))        content.teams = [];
    if (!Array.isArray(content.matches))      content.matches = [];
    if (typeof content.drawLocked !== 'boolean') content.drawLocked = false;
    const sr = (content.scoringRules ?? {}) as Record<string, unknown>;
    content.scoringRules = {
      pointsPerWin:      typeof sr.pointsPerWin      === 'number' ? sr.pointsPerWin      : 3,
      pointsPerDraw:     typeof sr.pointsPerDraw     === 'number' ? sr.pointsPerDraw     : 1,
      knockoutBonus:     typeof sr.knockoutBonus     === 'number' ? sr.knockoutBonus     : 5,
      quarterFinalBonus: typeof sr.quarterFinalBonus === 'number' ? sr.quarterFinalBonus : 10,
      semiFinalBonus:    typeof sr.semiFinalBonus    === 'number' ? sr.semiFinalBonus    : 15,
      finalBonus:        typeof sr.finalBonus        === 'number' ? sr.finalBonus        : 20,
      winnerBonus:       typeof sr.winnerBonus       === 'number' ? sr.winnerBonus       : 30,
    };
  }
}

// ── Server-side validation ────────────────────────────────────────────────────
function validateServerResponse(parsed: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!parsed.title || typeof parsed.title !== 'string' || parsed.title.trim().length === 0) {
    errors.push('Missing or empty title');
  } else if (parsed.title.length > 100) {
    errors.push('Title too long (max 100 chars)');
  }
  const creationType = parsed.creationType as string | undefined;
  if (!creationType || !SUPPORTED_TYPES.includes(creationType as SupportedType)) {
    errors.push(`Unsupported or missing creationType: ${creationType}`);
  }
  if (!parsed.content || typeof parsed.content !== 'object') {
    errors.push('Missing content object');
  } else {
    const content = parsed.content as Record<string, unknown>;
    if (content.type !== creationType) {
      errors.push(`content.type (${content.type}) does not match creationType (${creationType})`);
    }
    if (containsHtmlDeep(content)) {
      errors.push('Content contains raw HTML');
    }
  }
  if (typeof parsed.summary === 'string' && containsHtmlDeep(parsed.summary)) {
    errors.push('Summary contains raw HTML');
  }
  if (typeof parsed.title === 'string' && containsHtmlDeep(parsed.title)) {
    errors.push('Title contains raw HTML');
  }
  return { valid: errors.length === 0, errors };
}

// ── Main handler ──────────────────────────────────────────────────────────────
// ── CORS origin allowlist ─────────────────────────────────────────────────────
// Echo the caller's origin only when it's one of ours (site, Vercel previews,
// local dev). Anything else gets the primary domain, so foreign websites can't
// use visitors' browsers to call these functions.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?heytoolie\.com$/i,
  /^https:\/\/[\w.-]+\.vercel\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
];

function resolveAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  return origin && ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin))
    ? origin
    : 'https://heytoolie.com';
}

const handleRequest = async (req: Request): Promise<Response> => {
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

  // ── Daily quota: admin client + identity ──────────────────────────────────────
  // Service role bypasses RLS so the counter table is read/written here only.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAdmin = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;
  const identity = await getIdentity(req, supabaseAdmin);

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

  // ── User memory ────────────────────────────────────────────────────────────────
  // Fetch once here; thread into every prompt so Toolie already knows the user.
  const userMemory = identity.identifierType === 'user'
    ? await getUserMemory(supabaseAdmin, identity.identifier)
    : '';

  // ── Fast chat path ────────────────────────────────────────────────────────────
  // mode: 'chat' → single Gemini call with tool context. Returns either
  // { answer: string } for Q&A or { action: 'modify' } to escalate to the full pipeline.
  if (mode === 'chat') {
    const userMessage = body.userMessage as string | undefined;
    const creationType = body.creationType as string | undefined;
    const content = body.content as Record<string, unknown> | undefined;

    if (!userMessage || !creationType || !content) {
      return new Response(JSON.stringify({ error: 'chat mode requires userMessage, creationType, and content' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (userMessage.length > 500) {
      return new Response(JSON.stringify({ error: 'userMessage too long (max 500 chars)' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Daily chat quota ──────────────────────────────────────────────────────
    const chatQuota = await enforceQuota(supabaseAdmin, identity, 'chat');
    if (!chatQuota.allowed) return quotaExceededResponse(chatQuota);

    const chatPrompt = buildChatPrompt(creationType, content, userMessage, today, userMemory);
    const chatModel = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
    try {
      const result = await chatModel.generateContent(chatPrompt);
      const raw = result.response.text().trim();
      if (raw === 'ACTION:MODIFY') {
        return new Response(JSON.stringify({ action: 'modify', usage: usagePayload(chatQuota) }), {
          status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // Strip any accidental ACTION:MODIFY prefix from a verbose response
      const answer = raw.replace(/^ACTION:MODIFY\s*/i, '').trim() || "I'm not sure — try asking in a different way.";
      return new Response(JSON.stringify({ answer, usage: usagePayload(chatQuota) }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[chat] Gemini error:', e);
      return new Response(JSON.stringify({ error: 'Chat failed. Please try again.' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Scoped element edit path (Idea Board "tap-to-talk") ───────────────────────
  // mode: 'element_edit' → one Gemini call that reshapes a single element and
  // returns a small { patch } the client merges in place. Counts against the
  // lighter 'chat' quota.
  if (mode === 'element_edit') {
    const content = body.content as Record<string, unknown> | undefined;
    const elementKind = body.elementKind as string | undefined;
    const element = body.element;
    const instruction = body.instruction as string | undefined;

    if (!content || !elementKind || !instruction) {
      return new Response(JSON.stringify({ error: 'element_edit requires content, elementKind, and instruction' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (instruction.length > 500) {
      return new Response(JSON.stringify({ error: 'instruction too long (max 500 chars)' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const editQuota = await enforceQuota(supabaseAdmin, identity, 'chat');
    if (!editQuota.allowed) return quotaExceededResponse(editQuota);

    const prompt = buildElementEditPrompt(elementKind, element, instruction, content, userMemory);
    const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
    try {
      const result = await model.generateContent(prompt);
      const patch = parseJson(result.response.text()) as Record<string, unknown> | null;
      if (!patch || typeof patch !== 'object') {
        return new Response(JSON.stringify({ error: 'Could not update that. Please try again.' }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      if (containsHtmlDeep(patch)) {
        return new Response(JSON.stringify({ error: 'Invalid content.' }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ patch, usage: usagePayload(editQuota) }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[element_edit] Gemini error:', e);
      return new Response(JSON.stringify({ error: 'Could not update that. Please try again.' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Daily generation quota ────────────────────────────────────────────────────
  const genQuota = await enforceQuota(supabaseAdmin, identity, 'generation');
  if (!genQuota.allowed) return quotaExceededResponse(genQuota);

  const currentCreation = body.currentCreation as Record<string, unknown> | undefined;
  const oldContent = (currentCreation?.content as Record<string, unknown> | undefined) ?? null;
  const oldSig = oldContent ? getVisibleSignature(oldContent) : null;

  const genAI = new GoogleGenerativeAI(geminiKey);

  // ── Generation pipeline ─────────────────────────────────────────────────────
  // The whole flow lives in one closure so it can either run silently (legacy
  // single-JSON response) or narrate real stage events over an NDJSON stream
  // when the client opts in with body.stream === true.
  const runPipeline = async (
    emit: (e: Record<string, unknown>) => void,
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const fail = (msg: string) => ({ status: 422, body: { error: msg } });

    // ── Step 1+2: Intent Analysis + Template Selector ───────────────────────
    // Uses a lightweight prompt to extract type and requirements before building.
    emit({ event: 'stage', stage: 'understand' });
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

    // ── Forced type: guided entry points lock the output type ───────────────
    // (e.g. the Idea Board intake). We keep the classifier's requirements/tone but
    // override the type so the result is never a generic fallback.
    const forcedType = body.forcedType as string | undefined;
    if (forcedType && SUPPORTED_TYPES.includes(forcedType as SupportedType)) {
      intent.creationType = forcedType;
    }
    emit({
      event: 'stage',
      stage: 'understand_done',
      detail: { creationType: intent.creationType, isModification: mode !== 'new' },
    });

    // ── Step 3: UI/UX Designer Agent ─────────────────────────────────────────
    // Designs the mobile UX before content is built so the Builder knows exactly
    // what actions, fields, and controls are needed for a trustworthy experience.
    emit({ event: 'stage', stage: 'design' });
    const uxModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    let uxPlan: Record<string, unknown> = {};
    try {
      const uxResult = await uxModel.generateContent(buildUxDesignerPrompt(intent, body, today));
      const uxRaw = uxResult.response.text();
      const uxParsed = parseJson(uxRaw) as Record<string, unknown>;
      // Only use the plan if it has at least one actionable field
      if (uxParsed.primaryAction || uxParsed.requiredFields) {
        uxPlan = uxParsed;
      }
    } catch {
      // UX step failed — builder continues with defaults; no user impact
    }
    emit({
      event: 'stage',
      stage: 'design_done',
      detail: { primaryAction: typeof uxPlan.primaryAction === 'string' ? uxPlan.primaryAction : null },
    });

    // ── Step 4+5: Content Spec + Builder ──────────────────────────────────────
    // Main content generation with intent + UX plan injected into the user message.
    const builderModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemPrompt(today, userMemory),
    });

    const builderMessage = buildBuilderMessage(body, intent, uxPlan);

    // For recipe extraction, pass the cooking video to Gemini as a multimodal part
    // so it can actually "watch" it. Guarded to YouTube hosts; on any video error
    // the existing try/catch repair chain falls back to text-only (never 500s).
    const recipeVideoUrl = intent.creationType === 'recipe' && userRequest ? extractYouTubeUrl(userRequest) : null;
    emit({ event: 'stage', stage: 'build', detail: { watchingVideo: Boolean(recipeVideoUrl) } });
    const callBuilder = (message: string) =>
      builderModel.generateContent(
        recipeVideoUrl
          ? [{ text: message }, { fileData: { fileUri: recipeVideoUrl, mimeType: 'video/*' } }]
          : message,
      );

    let parsed: Record<string, unknown>;

    try {
      const result = await callBuilder(builderMessage);
      const raw = result.response.text();
      parsed = parseJson(raw) as Record<string, unknown>;
    } catch {
      // ── Step 6 (early repair): parse failure on first attempt ───────────────
      emit({ event: 'stage', stage: 'repair' });
      try {
        const retry = await callBuilder(
          `${builderMessage}\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation.`,
        );
        parsed = parseJson(retry.response.text()) as Record<string, unknown>;
      } catch {
        return fail('Could not generate a valid response. Please try again.');
      }
    }

    // ── Step 5: Normalize + server-side validation ───────────────────────────
    // Normalize first so missing numeric sub-fields get defaults before validation
    // and before the content is stored in the DB.
    emit({ event: 'stage', stage: 'check' });
    normalizeContentFields(parsed);
    const serverValidation = validateServerResponse(parsed);
    if (!serverValidation.valid) {
      emit({ event: 'stage', stage: 'repair' });
      try {
        const repairResult = await callBuilder(
          `${builderMessage}\n\n[VALIDATION FAILED: ${serverValidation.errors.join('; ')}. Fix all issues and return valid JSON only.]`,
        );
        const repairParsed = parseJson(repairResult.response.text()) as Record<string, unknown>;
        normalizeContentFields(repairParsed); // normalize the repair too
        if (validateServerResponse(repairParsed).valid) {
          parsed = repairParsed;
        } else {
          return fail('Could not generate a valid response. Please try again.');
        }
      } catch {
        return fail('Could not generate a valid response. Please try again.');
      }
    }

    // ── Step 6: QA — visible change check for improve/add ────────────────────
    const newContent = parsed.content as Record<string, unknown> | undefined;
    let changeReport: { changed: boolean; changes: string[]; unsupported: string[] } | undefined;

    if ((mode === 'improve' || mode === 'add') && oldSig && newContent) {
      const newSig = getVisibleSignature(newContent);
      const changed = newSig !== oldSig;

      if (!changed) {
        // ── Step 6: Repair — explicit no-op warning ───────────────────────────
        emit({ event: 'stage', stage: 'repair' });
        try {
          const repairMsg = `${builderMessage}\n\n[QA FAILURE: Your previous response returned identical visible content. The user's request was not satisfied. You MUST return content that visibly differs from the current version. Make a real change based on: "${userRequest}"]`;
          const repairResult = await callBuilder(repairMsg);
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
    const responseBody = changeReport
      ? { ...parsed, changeReport, usage: usagePayload(genQuota) }
      : { ...parsed, usage: usagePayload(genQuota) };

    return { status: 200, body: responseBody };
  };

  // ── Response: legacy single JSON, or live NDJSON stage stream ──────────────
  if (body.stream !== true) {
    const result = await runPipeline(() => {});
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (e: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        } catch {
          // Client disconnected mid-stream — keep the pipeline running silently
        }
      };
      runPipeline(emit)
        .then(({ status, body: out }) => {
          if (status === 200) emit({ event: 'done', data: out });
          else emit({ event: 'error', status, ...out });
        })
        .catch((err) => {
          console.error('[generate] pipeline error:', err);
          emit({ event: 'error', status: 500, error: 'The AI service had a problem. Please try again.' });
        })
        .finally(() => {
          try { controller.close(); } catch { /* already closed */ }
        });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
};

Deno.serve(async (req: Request) => {
  const res = await handleRequest(req);
  const headers = new Headers(res.headers);
  if (headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  }
  return new Response(res.body, { status: res.status, headers });
});
