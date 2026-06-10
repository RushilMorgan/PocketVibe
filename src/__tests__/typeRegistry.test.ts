/**
 * Drift net: a new creation type must be registered EVERYWHERE before it ships.
 *
 * The recipe_book incident: the type existed client-side but was missing from
 * the generate edge function's SUPPORTED_TYPES, so an AI edit could silently
 * rebuild a cookbook as a different type. The edge functions can't import
 * client code (separate Deno bundles), so this reads their SOURCE and asserts
 * every client type appears — drift now fails CI instead of corrupting tools.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CREATION_TYPES, TYPE_EMOJI, TYPE_LABEL, TYPE_ACCENT } from '../lib/creationTypeMeta';
import { SUPPORTED_TYPES as VALIDATOR_TYPES } from '../lib/validator';
import { getSupportedCapabilities } from '../lib/capabilityRegistry';

const root = join(__dirname, '..', '..');
const generateFn = readFileSync(join(root, 'supabase/functions/pocketvibe-generate/index.ts'), 'utf8');
const shareFn = readFileSync(join(root, 'supabase/functions/create-shared-creation/index.ts'), 'utf8');
const templateRenderer = readFileSync(join(root, 'src/components/templates/TemplateRenderer.tsx'), 'utf8');

describe('creation type registry stays in sync', () => {
  it.each(ALL_CREATION_TYPES)('"%s" is registered in the generate edge function', t => {
    expect(generateFn).toContain(`'${t}'`);
  });

  it.each(ALL_CREATION_TYPES)('"%s" is shareable (create-shared-creation)', t => {
    expect(shareFn).toContain(`'${t}'`);
  });

  it.each(ALL_CREATION_TYPES)('"%s" has a renderer case', t => {
    expect(templateRenderer).toContain(`case '${t}'`);
  });

  it.each(ALL_CREATION_TYPES)('"%s" passes the client validator allow-list', t => {
    expect(VALIDATOR_TYPES.has(t)).toBe(true);
  });

  it.each(ALL_CREATION_TYPES)('"%s" declares renderer capabilities', t => {
    expect(getSupportedCapabilities(t).length).toBeGreaterThan(0);
  });

  it.each(ALL_CREATION_TYPES)('"%s" has a system-prompt content format', t => {
    expect(generateFn).toContain(`"type":"${t}"`);
  });

  it('meta maps cover every type (and nothing extra)', () => {
    for (const map of [TYPE_EMOJI, TYPE_LABEL, TYPE_ACCENT]) {
      expect(Object.keys(map).sort()).toEqual([...ALL_CREATION_TYPES].sort());
    }
  });
});
