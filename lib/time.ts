/**
 * Calendar dates and clock times in a user's own time zone (IANA name, e.g.
 * "Europe/London"), via Intl so daylight saving is handled. Pure and
 * client-safe. Users default to South Africa until their phone reports its zone.
 */
export const DEFAULT_TZ = 'Africa/Johannesburg';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const formats = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatFor(tz: string): Intl.DateTimeFormat {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  let f = formats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formats.set(zone, f);
  }
  return f;
}

/** The local date (YYYY-MM-DD), hour, minute and weekday (Mon = 0) of an instant. */
export function localParts(at: Date | string, tz: string): { date: string; hour: number; minute: number; weekday: number } {
  const parts: Record<string, string> = {};
  for (const p of formatFor(tz).formatToParts(new Date(at))) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** The local calendar date of an instant, as YYYY-MM-DD. */
export function localDate(at: Date | string, tz: string = DEFAULT_TZ): string {
  return localParts(at, tz).date;
}
