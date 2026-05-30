/**
 * Diagnostic smoke-test for the API-Football (api-sports) key.
 * Tests account status, available WC 2026 data, and suggests fixes.
 *
 * Usage:
 *   node scripts/test-football-api.mjs <API_KEY>
 *   API_FOOTBALL_KEY=xxx node scripts/test-football-api.mjs
 */

const apiKey = process.argv[2] || process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error('Usage: node scripts/test-football-api.mjs <API_KEY>');
  process.exit(1);
}

const BASE = 'https://v3.football.api-sports.io';
const HEADERS = {
  'x-apisports-key': apiKey,
  'x-rapidapi-key':  apiKey,
  'x-rapidapi-host': 'v3.football.api-sports.io',
};

async function get(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: HEADERS });
  const body = await res.json();
  return { status: res.status, body, url };
}

function printErrors(body) {
  const e = body?.errors;
  if (!e) return;
  const msgs = Array.isArray(e) ? e : Object.values(e);
  if (msgs.length) console.log('   Errors:', msgs.join(', '));
}

(async () => {
  console.log('─'.repeat(60));
  console.log('API-Football key diagnostic');
  console.log('─'.repeat(60));

  // ── 1. Account / key validity ─────────────────────────────────
  console.log('\n[1/4] Account status');
  const { status: s1, body: b1 } = await get('/status');
  if (s1 !== 200) {
    console.error(`❌  HTTP ${s1} — key is likely invalid`);
    console.error(JSON.stringify(b1, null, 2));
    process.exit(1);
  }

  const acct = b1?.response?.account;
  const sub  = b1?.response?.subscription;
  const reqs = b1?.response?.requests;
  console.log(`✅  Key valid`);
  console.log(`    Name:     ${acct?.firstname} ${acct?.lastname}`);
  console.log(`    Plan:     ${sub?.plan}`);
  console.log(`    Requests: ${reqs?.current} used / ${reqs?.limit_day} today limit`);
  console.log(`    Sub ends: ${sub?.end}`);

  // ── 2. Search for World Cup 2026 league ───────────────────────
  console.log('\n[2/4] Searching for World Cup 2026 league');
  const { body: b2 } = await get('/leagues?name=World%20Cup&season=2026');
  const wcLeagues = b2?.response ?? [];
  printErrors(b2);

  if (wcLeagues.length === 0) {
    console.log('⚠️  No "World Cup" league found for season 2026');
    console.log('   Trying season=2025…');

    const { body: b2b } = await get('/leagues?name=World%20Cup&season=2025');
    const wcLeagues25 = b2b?.response ?? [];
    if (wcLeagues25.length > 0) {
      console.log(`   Found ${wcLeagues25.length} result(s) for 2025:`);
      wcLeagues25.forEach(l => {
        console.log(`   League ${l.league.id}: ${l.league.name} (${l.country?.name})`);
      });
    }

    // Also try with no season filter
    const { body: b2c } = await get('/leagues?name=World%20Cup');
    const wcLeaguesAll = b2c?.response ?? [];
    console.log(`\n   All "World Cup" leagues (no season filter): ${wcLeaguesAll.length} result(s)`);
    wcLeaguesAll.slice(0, 5).forEach(l => {
      const seasons = l.seasons?.map(s => s.year).join(', ') ?? 'n/a';
      console.log(`   League ${l.league.id}: ${l.league.name} (${l.country?.name}) — seasons: ${seasons}`);
    });
  } else {
    console.log(`✅  Found ${wcLeagues.length} World Cup 2026 league(s):`);
    wcLeagues.forEach(l => {
      console.log(`   League ${l.league.id}: ${l.league.name} (${l.country?.name})`);
    });
  }

  // ── 3. Teams for WC 2026 (league=1) ──────────────────────────
  console.log('\n[3/4] Teams for league=1, season=2026 (current edge function config)');
  const { body: b3 } = await get('/teams?league=1&season=2026');
  const teams = b3?.response ?? [];
  printErrors(b3);

  if (teams.length === 0) {
    console.log('⚠️  No teams returned — either the league ID is wrong, the plan');
    console.log('   doesn\'t cover this data, or the 2026 season isn\'t published yet.');

    // Try 2025
    const { body: b3b } = await get('/teams?league=1&season=2025');
    const t25 = b3b?.response ?? [];
    console.log(`   league=1 season=2025: ${t25.length} teams`);
  } else {
    console.log(`✅  ${teams.length} teams found for league=1, season=2026`);
    console.log(`   Sample: ${teams.slice(0,5).map(t => t.team.name).join(', ')}`);
  }

  // ── 4. Fixtures for WC 2026 ───────────────────────────────────
  console.log('\n[4/4] Fixtures for league=1, season=2026');
  const { body: b4 } = await get('/fixtures?league=1&season=2026');
  const fixtures = b4?.response ?? [];
  printErrors(b4);

  if (fixtures.length === 0) {
    console.log('⚠️  No fixtures returned');

    // Try finding any fixtures for league=1 to confirm access
    const { body: b4b } = await get('/fixtures?league=1&season=2025&last=3');
    const f25 = b4b?.response ?? [];
    console.log(`   league=1 season=2025 (last 3): ${f25.length} fixtures — ${f25.length > 0 ? 'plan has access' : 'no access to this league'}`);
    if (f25.length > 0) {
      console.log(`   Sample: ${f25[0].teams.home.name} vs ${f25[0].teams.away.name}`);
    }
  } else {
    console.log(`✅  ${fixtures.length} fixtures found`);
    const sample = fixtures[0];
    console.log(`   First: ${sample.teams.home.name} vs ${sample.teams.away.name}  —  ${sample.fixture.date?.slice(0,10) ?? 'TBD'} (${sample.fixture.status?.short})`);
    const byStatus = fixtures.reduce((acc, f) => {
      const s = f.fixture.status?.short ?? '?';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`   By status: ${Object.entries(byStatus).map(([k,v]) => `${k}×${v}`).join('  ')}`);
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  const hasTeams = teams.length > 0;
  const hasFixtures = fixtures.length > 0;

  if (hasTeams && hasFixtures) {
    console.log('✅  All checks passed — API key has full WC 2026 data access.');
    console.log('   The Supabase edge function should sync correctly.');
  } else if (!hasTeams && !hasFixtures) {
    console.log('⚠️  API key works but WC 2026 data is not available under league=1.');
    console.log('   Possible causes:');
    console.log('   • Free-tier plan — WC data may require a paid tier');
    console.log('   • League ID 1 may not be WC 2026 in this API version');
    console.log('   • The 2026 season fixtures haven\'t been published yet');
    console.log('\n   Check the league search above and update WC_LEAGUE_ID in');
    console.log('   supabase/functions/sync-world-cup-results/index.ts if needed.');
  }
  console.log('─'.repeat(60));
})();
