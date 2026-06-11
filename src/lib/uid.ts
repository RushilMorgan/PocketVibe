let _uid = 0;

/** Unique-enough id for locally created items (ingredients, steps, …). */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_uid}`;
}
