#!/usr/bin/env node
/**
 * Manual integration test for shared creation edge functions.
 * Usage: node scripts/test-shared-creation.mjs
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.warn('No .env file found — using existing environment variables');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  apikey: SUPABASE_ANON_KEY,
};

function fn(name) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function requireOk(res) {
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`);
  return body;
}

console.log('\n── PocketVibe Shared Creation Integration Test ──\n');

// 1. Create shared creation
console.log('1. Creating shared creation…');
const created = await requireOk(
  await fetch(fn('create-shared-creation'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      title: 'Test Partner Challenge',
      creationType: 'workout_tracker',
      content: {
        type: 'workout_tracker',
        planName: 'Test Partner Challenge',
        challengeMode: true,
        participants: [
          { id: 'p1', name: 'Alice', emoji: '🏃' },
          { id: 'p2', name: 'Bob', emoji: '🚴' },
        ],
        logs: [],
        weeklyTarget: 3,
        scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
      },
    }),
  }),
);
console.log(`   ✓ slug=${created.shareSlug}`);
console.log(`   View URL: ${created.viewUrl}`);
console.log(`   Admin URL: ${created.adminUrl}`);

// 2. Load as viewer
console.log('\n2. Loading as viewer (no token)…');
const viewerLoad = await requireOk(
  await fetch(`${fn('get-shared-creation')}?shareSlug=${created.shareSlug}`, {
    headers: HEADERS,
  }),
);
console.log(`   ✓ accessMode=${viewerLoad.accessMode}`);

// 3. Load as admin
console.log('\n3. Loading as admin…');
const adminLoad = await requireOk(
  await fetch(`${fn('get-shared-creation')}?shareSlug=${created.shareSlug}&token=${created.adminToken}`, {
    headers: HEADERS,
  }),
);
console.log(`   ✓ accessMode=${adminLoad.accessMode}`);

// 4. Create participant link
console.log('\n4. Creating participant link for Bob…');
const pLink = await requireOk(
  await fetch(fn('create-participant-link'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      shareSlug: created.shareSlug,
      adminToken: created.adminToken,
      participantRef: 'p2',
      displayName: 'Bob',
      emoji: '🚴',
    }),
  }),
);
console.log(`   ✓ Participant URL: ${pLink.participantUrl}`);

// 5. Load as participant
console.log('\n5. Loading as participant (Bob)…');
const pLoad = await requireOk(
  await fetch(`${fn('get-shared-creation')}?shareSlug=${created.shareSlug}&token=${pLink.participantToken}`, {
    headers: HEADERS,
  }),
);
console.log(`   ✓ accessMode=${pLoad.accessMode}, participantRef=${pLoad.participantRef}`);

// 6. Participant updates their own log
console.log('\n6. Bob logs a run…');
const today = new Date().toISOString().slice(0, 10);
const updated = await requireOk(
  await fetch(fn('update-shared-creation'), {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      shareSlug: created.shareSlug,
      token: pLink.participantToken,
      patch: {
        logs: [{ id: 'log-1', participantId: 'p2', date: today, activityType: 'run' }],
      },
      expectedVersion: viewerLoad.creation.version,
    }),
  }),
);
console.log(`   ✓ Updated to version ${updated.version}`);

// 7. Participant tries to add a log for Alice (should fail)
console.log('\n7. Bob tries to log activity for Alice (should be denied)…');
const badUpdate = await fetch(fn('update-shared-creation'), {
  method: 'PATCH',
  headers: HEADERS,
  body: JSON.stringify({
    shareSlug: created.shareSlug,
    token: pLink.participantToken,
    patch: {
      logs: [
        { id: 'log-1', participantId: 'p2', date: today, activityType: 'run' },
        { id: 'log-2', participantId: 'p1', date: today, activityType: 'walk' }, // Alice's ID
      ],
    },
    expectedVersion: updated.version,
  }),
});
if (badUpdate.status === 403) {
  console.log('   ✓ Correctly denied (403)');
} else {
  console.error(`   ✗ Expected 403 but got ${badUpdate.status}`);
}

console.log('\n── All tests passed ──\n');
