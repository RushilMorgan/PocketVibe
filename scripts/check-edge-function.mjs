#!/usr/bin/env node
/**
 * Integrity check for the Supabase Edge Function.
 * Run: node scripts/check-edge-function.mjs
 * Checks:
 *   - Exactly one Deno.serve() call (no duplicate handlers)
 *   - Exactly one import for GoogleGenerativeAI (no duplicate imports)
 *   - No survey_form in the system prompt
 *   - No generative_html in the system prompt
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'supabase', 'functions', 'pocketvibe-generate', 'index.ts');

const content = readFileSync(filePath, 'utf8');

const failures = [];

// Check 1: exactly one Deno.serve
const denoServeCount = (content.match(/Deno\.serve\(/g) ?? []).length;
if (denoServeCount !== 1) {
  failures.push(`Expected exactly 1 Deno.serve(), found ${denoServeCount}`);
}

// Check 2: exactly one GoogleGenerativeAI import
const importCount = (content.match(/import\s+\{[^}]*GoogleGenerativeAI[^}]*\}\s+from\s+['"]npm:/g) ?? []).length;
if (importCount !== 1) {
  failures.push(`Expected exactly 1 GoogleGenerativeAI import, found ${importCount}`);
}

// Check 3: no survey_form in server prompt
if (content.includes('survey_form')) {
  const lines = content.split('\n');
  const lineNums = lines
    .map((l, i) => (l.includes('survey_form') ? i + 1 : -1))
    .filter(n => n > 0);
  failures.push(`survey_form found in server file at line(s): ${lineNums.join(', ')}`);
}

// Check 4: no generative_html in server file
if (content.includes('generative_html')) {
  failures.push('generative_html found in server file');
}

if (failures.length > 0) {
  console.error('Edge function integrity check FAILED:');
  for (const f of failures) {
    console.error(`  ✗ ${f}`);
  }
  process.exit(1);
}

console.log('Edge function integrity check passed ✓');
process.exit(0);
