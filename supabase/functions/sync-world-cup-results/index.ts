// Supabase Edge Function — sync-world-cup-results (Gemini-powered)
// Fetches recent FIFA World Cup 2026 results from Gemini with Google Search
// grounding (no paid sports API needed), validates the data, and upserts into
// the canonical world_cup_matches and world_cup_teams tables.
//
// Required secrets (already in your project):
//   GEMINI_API_KEY          — same key used by pocketvibe-generate
//   SUPABASE_URL            — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase
//   WORLD_CUP_SYNC_SECRET   — optional; used when calling manually
//
// Deploy: supabase functions deploy sync-world-cup-results
// Manual invoke:
//   curl -X POST https://<project>.supabase.co/functions/v1/sync-world-cup-results \
//     -H "Authorization: Bearer <service_role_key>"
//
// The cron job is set up via schema-wc-cron.sql — runs every 6 hours.

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// World Cup 2026 window: June 11 – July 19
const WC_START = '2026-06-11';
const WC_END   = '2026-07-19';

// ── Team name normalisation ───────────────────────────────────────────────────
// Gemini and web sources use many spellings. All values are canonical lowercase
// names matching what's stored in world_cup_teams.name.

const TEAM_ALIASES: Record<string, string> = {
  // USA
  'usa':                              'united states',
  'usmnt':                            'united states',
  'united states of america':         'united states',
  'u.s.a.':                           'united states',
  'u.s.':                             'united states',
  // Korea
  'korea republic':                   'south korea',
  'republic of korea':                'south korea',
  'korea':                            'south korea',
  // Ivory Coast
  "cote d'ivoire":                    "côte d'ivoire",
  "cote d ivoire":                    "côte d'ivoire",
  'ivory coast':                      "côte d'ivoire",
  // Cape Verde
  'cape verde':                       'cabo verde',
  // Congo
  'dr congo':                         'dr congo',
  'congo dr':                         'dr congo',
  'democratic republic of congo':     'dr congo',
  'democratic republic of the congo': 'dr congo',
  'drc':                              'dr congo',
  // Bosnia
  'bosnia':                           'bosnia and herzegovina',
  'bosnia-herzegovina':               'bosnia and herzegovina',
  // Turkey
  'türkiye':                          'turkey',
  'turkiye':                          'turkey',
  // Czech Republic
  'czech republic':                   'czechia',
  // Netherlands
  'holland':                          'netherlands',
  'the netherlands':                  'netherlands',
  // Curacao
  'curaçao':                          'curacao',
};

function normalise(name: string): string {
  const lower = (name ?? '').trim().toLowerCase();
  return TEAM_ALIASES[lower] ?? lower;
}

// ── Stage helpers ─────────────────────────────────────────────────────────────

const VALID_STAGES = new Set([
  'group', 'round_of_32', 'round_of_16',
  'quarter_final', 'semi_final', 'final',
]);

function normaliseStage(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('group'))                                         return 'group';
  if (s.includes('32'))                                            return 'round_of_32';
  if (s.includes('16'))                                            return 'round_of_16';
  if (s.includes('quarter'))                                       return 'quarter_final';
  if (s.includes('semi'))                                          return 'semi_final';
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 'final';
  return 'group';
}

function stageRank(stage: string): number {
  const ORDER = ['active', 'group', 'round_of_32', 'round_of_16',
                 'quarter_final', 'semi_final', 'final', 'winner'];
  const i = ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

// ── Synthetic match ID ────────────────────────────────────────────────────────
// API-Football uses large positive integers; we use negatives for Gemini rows.
// Deterministic hash → idempotent (re-running doesn't create duplicates).

function syntheticMatchId(homeTeamId: number, awayTeamId: number, date: string): number {
  const key = `${homeTeamId}-${awayTeamId}-${date}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return -(Number(h % 9000000) + 1000000); // always negative, 7 digits
}

// ── Gemini prompt ─────────────────────────────────────────────────────────────

function buildPrompt(daysBack: number): string {
  const today = new Date();
  const from  = new Date(today.getTime() - daysBack * 86_400_000);
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);

  return [
    'You are a football data assistant. Use Google Search to find the latest information.',
    '',
    `Find all FIFA World Cup 2026 match results between ${fmt(from)} and ${fmt(today)}.`,
    'Include ONLY matches that have fully finished with a confirmed final score.',
    'Do NOT include scheduled, live, postponed, or future matches.',
    '',
    'Return ONLY a valid JSON array — no markdown, no explanation, no extra text.',
    'Each element must have exactly these fields:',
    '{',
    '  "home_team": "official FIFA team name",',
    '  "away_team": "official FIFA team name",',
    '  "score_home": <integer>,',
    '  "score_away": <integer>,',
    '  "match_date": "YYYY-MM-DD",',
    '  "stage": "group | round_of_32 | round_of_16 | quarter_final | semi_final | final"',
    '}',
    '',
    'Important:',
    '- Use official FIFA names (e.g. "United States" not "USA", "Côte d\'Ivoire" not "Ivory Coast")',
    '- Scores must be the FINAL score (after extra time or penalties if played)',
    '- Only FIFA World Cup 2026 matches — no friendlies or other tournaments',
    `- If no finished World Cup matches occurred between ${fmt(from)} and ${fmt(today)}, return: []`,
  ].join('\n');
}

// ── Response validation ───────────────────────────────────────────────────────

interface MatchResult {
  home_team:  string;
  away_team:  string;
  score_home: number;
  score_away: number;
  match_date: string;
  stage:      string;
}

interface ValidationResult {
  valid:       MatchResult[];
  rejected:    Array<{ raw: unknown; reason: string }>;
  parseError?: string;
}

function validateResponse(rawText: string): ValidationResult {
  const result: ValidationResult = { valid: [], rejected: [] };

  // Strip markdown fences the model occasionally adds
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    result.parseError = `JSON parse failed. Raw preview: ${rawText.slice(0, 300)}`;
    return result;
  }

  if (!Array.isArray(parsed)) {
    result.parseError = `Expected array, got: ${typeof parsed}`;
    return result;
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const item of parsed) {
    const reject = (reason: string) => result.rejected.push({ raw: item, reason });

    if (!item || typeof item !== 'object') { reject('not an object'); continue; }

    const { home_team, away_team, score_home, score_away, match_date, stage } = item as any;

    if (!home_team || typeof home_team !== 'string')   { reject(`missing/invalid home_team: ${home_team}`);  continue; }
    if (!away_team || typeof away_team !== 'string')   { reject(`missing/invalid away_team: ${away_team}`);  continue; }
    if (!Number.isInteger(score_home) || score_home < 0 || score_home > 20) { reject(`invalid score_home: ${score_home}`); continue; }
    if (!Number.isInteger(score_away) || score_away < 0 || score_away > 20) { reject(`invalid score_away: ${score_away}`); continue; }
    if (!match_date || !/^\d{4}-\d{2}-\d{2}$/.test(match_date)) { reject(`invalid match_date: ${match_date}`); continue; }
    if (match_date < WC_START || match_date > WC_END)  { reject(`date ${match_date} outside WC window`); continue; }
    if (match_date > today)                            { reject(`future date: ${match_date}`); continue; }
    if (normalise(home_team) === normalise(away_team)) { reject('home and away teams are the same'); continue; }

    result.valid.push({
      home_team:  home_team.trim(),
      away_team:  away_team.trim(),
      score_home,
      score_away,
      match_date,
      stage: normaliseStage(stage ?? 'group'),
    });
  }

  return result;
}

// ── Timing-safe string compare (prevent timing attacks on secrets) ────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Top-level catch — ensures we always return JSON, never a bare platform 500
  try {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const syncSecret  = Deno.env.get('WORLD_CUP_SYNC_SECRET');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const reqSecret   = req.headers.get('x-sync-secret');
  const authHeader  = req.headers.get('authorization') ?? '';
  const bearer      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const validSecret = syncSecret && reqSecret && timingSafeEqual(reqSecret, syncSecret);
  const validBearer = serviceRole && bearer  && timingSafeEqual(bearer, serviceRole);

  if (!validSecret && !validBearer) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Optional body param: { days_back: number } — how far back to look (default 3)
  let daysBack = 3;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.days_back === 'number') daysBack = Math.min(Math.max(1, body.days_back), 14);
  } catch { /* ignore */ }

  const startMs = Date.now();
  let matchesUpdated   = 0;
  let matchesInserted  = 0;
  let stagesUpdated    = 0;
  let rejected: Array<{ raw: unknown; reason: string }> = [];
  let errorMessage: string | null = null;
  let syncStatus: 'success' | 'partial' | 'no_matches' | 'failed' = 'success';

  try {
    // ── 1. Ask Gemini (with Google Search grounding for live results) ─────────
    console.log(`[sync-wc] Querying Gemini for last ${daysBack} day(s) of WC 2026 results…`);
    const genAI = new GoogleGenerativeAI(geminiKey);
    // Try with Google Search grounding first (real-time results).
    // Fall back to plain generation if grounding isn't supported by this SDK version.
    let rawText = '';
    try {
      const modelWithSearch = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ googleSearch: {} }] as any,
      });
      const res = await modelWithSearch.generateContent(buildPrompt(daysBack));
      rawText = res.response.text().trim();
      console.log('[sync-wc] Used Google Search grounding');
    } catch (groundingErr: any) {
      console.warn('[sync-wc] Search grounding unavailable, falling back:', groundingErr?.message);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const res = await model.generateContent(buildPrompt(daysBack));
      rawText = res.response.text().trim();
    }
    console.log(`[sync-wc] Gemini raw (${rawText.length} chars): ${rawText.slice(0, 400)}`);

    // ── 2. Validate ───────────────────────────────────────────────────────────
    const validation = validateResponse(rawText);
    rejected = validation.rejected;

    if (validation.parseError) throw new Error(validation.parseError);

    if (validation.valid.length === 0) {
      console.log('[sync-wc] No finished matches found in this window.');
      syncStatus = 'no_matches';
    } else {
      console.log(`[sync-wc] ${validation.valid.length} valid, ${rejected.length} rejected.`);

      // ── 3. Load known teams from DB ───────────────────────────────────────
      const { data: dbTeams, error: teamsErr } = await supabase
        .from('world_cup_teams')
        .select('id, name, provider_team_id, stage');
      if (teamsErr) throw new Error(`Could not load teams: ${teamsErr.message}`);

      const teamByName = new Map<string, any>();
      for (const t of (dbTeams ?? [])) {
        teamByName.set(normalise(t.name), t);
      }

      // ── 4. Load manual-override IDs (never touch these) ───────────────────
      const { data: overrides } = await supabase
        .from('world_cup_matches')
        .select('provider_match_id')
        .eq('is_manual_override', true);
      const overrideIds = new Set((overrides ?? []).map((r: any) => r.provider_match_id));

      // ── 5. Upsert each validated result ───────────────────────────────────
      const pendingStageUpdates = new Map<number, string>(); // provider_team_id → next stage

      for (const m of validation.valid) {
        const homeTeam = teamByName.get(normalise(m.home_team));
        const awayTeam = teamByName.get(normalise(m.away_team));

        if (!homeTeam || !awayTeam) {
          rejected.push({ raw: m, reason: `Unknown team: ${!homeTeam ? m.home_team : m.away_team}` });
          continue;
        }

        // Find existing match row — try both home/away orientations in case
        // Gemini swapped them (it sometimes does for away games)
        let matchRow: any = null;
        for (const [hId, aId] of [
          [homeTeam.provider_team_id, awayTeam.provider_team_id],
          [awayTeam.provider_team_id, homeTeam.provider_team_id],
        ]) {
          const { data } = await supabase
            .from('world_cup_matches')
            .select('*')
            .eq('home_team_id', hId)
            .eq('away_team_id', aId)
            .gte('match_date', `${m.match_date}T00:00:00Z`)
            .lte('match_date', `${m.match_date}T23:59:59Z`)
            .maybeSingle();
          if (data) { matchRow = data; break; }
        }

        if (matchRow) {
          if (overrideIds.has(matchRow.provider_match_id)) {
            console.log(`[sync-wc] Protected (manual override): ${m.home_team} vs ${m.away_team}`);
            continue;
          }
          const { error } = await supabase
            .from('world_cup_matches')
            .update({ score_home: m.score_home, score_away: m.score_away, status: 'finished', updated_at: new Date().toISOString() })
            .eq('id', matchRow.id);
          if (error) { rejected.push({ raw: m, reason: `Update failed: ${error.message}` }); continue; }
          matchesUpdated++;
        } else {
          // No existing row — create one with a synthetic ID
          const synthId = syntheticMatchId(homeTeam.provider_team_id, awayTeam.provider_team_id, m.match_date);
          if (overrideIds.has(synthId)) continue;

          const { error } = await supabase.from('world_cup_matches').upsert({
            provider_match_id: synthId,
            home_team_id:      homeTeam.provider_team_id,
            away_team_id:      awayTeam.provider_team_id,
            score_home:        m.score_home,
            score_away:        m.score_away,
            match_date:        `${m.match_date}T12:00:00Z`,
            stage:             m.stage,
            round:             m.stage,
            status:            'finished',
            is_manual_override: false,
            updated_at:        new Date().toISOString(),
          }, { onConflict: 'provider_match_id', ignoreDuplicates: false });

          if (error) { rejected.push({ raw: m, reason: `Insert failed: ${error.message}` }); continue; }
          matchesInserted++;
        }

        // ── Stage advancement for knockout matches ─────────────────────────
        if (m.stage !== 'group') {
          const WIN_NEXT: Record<string, string> = {
            round_of_32: 'round_of_16', round_of_16: 'quarter_final',
            quarter_final: 'semi_final', semi_final: 'final', final: 'winner',
          };
          const homeWins   = m.score_home > m.score_away;
          const winner     = homeWins ? homeTeam : awayTeam;
          const loser      = homeWins ? awayTeam : homeTeam;
          const nextStage  = WIN_NEXT[m.stage];

          if (nextStage) {
            const prev = pendingStageUpdates.get(winner.provider_team_id);
            if (!prev || stageRank(nextStage) > stageRank(prev)) {
              pendingStageUpdates.set(winner.provider_team_id, nextStage);
            }
            if (!pendingStageUpdates.has(loser.provider_team_id)) {
              pendingStageUpdates.set(loser.provider_team_id, 'eliminated');
            }
          }
        }
      }

      // ── 6. Apply team stage updates ───────────────────────────────────────
      for (const [provTeamId, newStage] of pendingStageUpdates) {
        const { error } = await supabase
          .from('world_cup_teams')
          .update({ stage: newStage, updated_at: new Date().toISOString() })
          .eq('provider_team_id', provTeamId)
          .neq('stage', newStage); // skip if already at this stage
        if (!error) stagesUpdated++;
      }

      if (matchesUpdated === 0 && matchesInserted === 0 && rejected.length > 0) {
        syncStatus = 'failed';
      } else if (rejected.length > 0) {
        syncStatus = 'partial';
      }
    }

  } catch (err: any) {
    console.error('[sync-wc] Fatal error:', err?.message ?? err);
    errorMessage = err?.message ?? String(err);
    syncStatus = 'failed';
  }

  const durationMs = Date.now() - startMs;

  // ── Audit log ─────────────────────────────────────────────────────────────
  try {
    await supabase.from('world_cup_sync_log').insert({
      status:           syncStatus,
      matches_upserted: matchesUpdated + matchesInserted,
      teams_upserted:   stagesUpdated,
      error_message:    errorMessage ?? (rejected.length > 0 ? `${rejected.length} item(s) rejected` : null),
      provider:         'gemini-search',
      duration_ms:      durationMs,
    });
  } catch (logErr: any) {
    console.error('[sync-wc] Log write failed:', logErr?.message);
  }

  console.log(`[sync-wc] Done in ${durationMs}ms — updated:${matchesUpdated} inserted:${matchesInserted} stages:${stagesUpdated} rejected:${rejected.length}`);

  return new Response(JSON.stringify({
    status: syncStatus,
    matchesUpdated,
    matchesInserted,
    stagesUpdated,
    durationMs,
    rejected: rejected.map(r => ({ reason: r.reason, match: r.raw })),
    error: errorMessage,
  }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (topErr: any) {
    // Safety net — should never reach here, but surfaces the real error if it does
    console.error('[sync-wc] Unhandled top-level error:', topErr?.message ?? topErr);
    return new Response(
      JSON.stringify({ status: 'failed', error: topErr?.message ?? String(topErr) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
