/**
 * Replaces {name} placeholders. Unknown placeholders are an error so a typo in
 * a prompt file can't silently ship "{top_topcs}" to the model.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Prompt placeholder {${key}} has no value`);
    return vars[key];
  });
}
