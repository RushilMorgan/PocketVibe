import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillTemplate } from './template';

/**
 * Every prompt file must fill with exactly the variables its caller passes. A
 * stray {word} in prose (e.g. "%%{init}%%") would otherwise throw at runtime.
 * Files not listed are filled with no variables.
 */
const CTX = ['level', 'tone', 'top_topics'];
const VARS: Record<string, string[]> = {
  classifier: CTX,
  explainer: [...CTX, 'mode_instruction'],
  chat: [...CTX, 'sources'],
  diagram: CTX,
  lesson: [...CTX, 'template', 'template_rules', 'avoid'],
  finds: [...CTX, 'topic', 'exclude'],
  recipe: ['tone'],
};

const dir = path.join(process.cwd(), 'prompts');

describe('prompt files', () => {
  it.each(readdirSync(dir).filter((f) => f.endsWith('.md')))('%s fills with its caller’s variables', (file) => {
    const vars = Object.fromEntries((VARS[file.replace(/\.md$/, '')] ?? []).map((k) => [k, `<${k}>`]));
    expect(() => fillTemplate(readFileSync(path.join(dir, file), 'utf8'), vars)).not.toThrow();
  });
});
