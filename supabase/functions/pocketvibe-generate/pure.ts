// Pure, dependency-free helpers shared by the edge function and unit tests.
// No Deno or npm imports here on purpose, so vitest (Node) can import this file
// directly. The edge function re-imports these with an explicit .ts extension.

// ── Visible signature (mirrors src/lib/visibleSignature.ts) ───────────────────
export function getVisibleSignature(content: Record<string, unknown>): string {
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
export function describeChanges(oldContent: Record<string, unknown>, newContent: Record<string, unknown>): string[] {
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
export function extractYouTubeUrl(text: string): string | null {
  const m = text.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:shorts\/|watch\?[^\s]*v=|live\/)|youtu\.be\/)[\w-]+[^\s]*/i,
  );
  return m ? m[0] : null;
}

// ── JSON parse with fence stripping ──────────────────────────────────────────
export function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}
