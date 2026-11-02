import type { DigestContent } from './schema';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Turns a plain target (an app path or external URL) into a tracked link. */
export type Linker = (to: string) => string;

/**
 * The digest as an email: subject, HTML (inline styles; email clients ignore
 * stylesheets) and a plain-text part. Every link goes through `link` so taps
 * are logged as digest_open.
 */
export function renderDigestEmail(d: DigestContent, link: Linker): { subject: string; html: string; text: string } {
  const findCount = d.finds.reduce((n, f) => n + f.items.length, 0);
  const subject =
    d.stats.saved > 0
      ? `Your week: ${d.stats.saved} save${d.stats.saved === 1 ? '' : 's'}, ${findCount} new find${findCount === 1 ? '' : 's'}`
      : `${findCount} new finds for you this week`;

  const a = (to: string, label: string) => `<a href="${esc(link(to))}" style="color:#4f46e5;text-decoration:none">${esc(label)}</a>`;
  const h2 = (t: string) => `<h2 style="font-size:18px;margin:28px 0 8px">${esc(t)}</h2>`;
  const h3 = (t: string) => `<p style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#78716c;margin:16px 0 4px">${esc(t)}</p>`;

  const week = d.groups.length
    ? d.groups
        .map(
          (g) =>
            h3(g.topic) +
            g.items
              .map((i) => `<p style="margin:4px 0">${a(`/items/${i.id}`, i.title)}${i.line ? `<br><span style="color:#78716c">${esc(i.line)}</span>` : ''}</p>`)
              .join(''),
        )
        .join('')
    : '<p style="color:#78716c">Nothing saved this week — share a link from any app to start.</p>';

  const finds = d.finds.length
    ? d.finds
        .map(
          (f) =>
            h3(f.topic) +
            f.items.map((i) => `<p style="margin:4px 0">${a(i.url, i.title)}<br><span style="color:#78716c">${esc(i.why)}</span></p>`).join(''),
        )
        .join('')
    : '<p style="color:#78716c">No new finds this week.</p>';

  const lesson = d.lesson
    ? h2('A 2-minute lesson') +
      `<p style="margin:4px 0">From something you saved but haven't opened: <strong>${esc(d.lesson.itemTitle)}</strong></p>` +
      `<p style="margin:12px 0"><a href="${esc(link(`/play/${d.lesson.lessonId}`))}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">▶ Play it</a></p>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#fafaf9">
<div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">
<p style="font-size:22px;font-weight:600;margin:0">Your week in HeyToolie</p>
<p style="color:#78716c;margin:4px 0 0">${esc(d.from)} – ${esc(d.to)}</p>
${h2('Your week')}${week}
${h2('New for you')}${finds}
${lesson}
<p style="margin:32px 0 0;font-size:13px;color:#78716c">${a('/settings', 'Settings')} · You get this every Sunday.</p>
</div></body></html>`;

  const text = [
    `Your week in HeyToolie (${d.from} – ${d.to})`,
    '',
    'YOUR WEEK',
    ...d.groups.flatMap((g) => [`${g.topic}:`, ...g.items.map((i) => `- ${i.title} ${link(`/items/${i.id}`)}`)]),
    '',
    'NEW FOR YOU',
    ...d.finds.flatMap((f) => [`${f.topic}:`, ...f.items.map((i) => `- ${i.title} — ${i.why} ${link(i.url)}`)]),
    ...(d.lesson ? ['', `2-MINUTE LESSON: ${d.lesson.itemTitle} ${link(`/play/${d.lesson.lessonId}`)}`] : []),
  ].join('\n');

  return { subject, html, text };
}
