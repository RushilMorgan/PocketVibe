import 'server-only';
import sharp from 'sharp';

/** Final PNG width (SPEC: 1080 px), with side padding. */
const WIDTH = 1080;
const PAD = 48;

/**
 * Applied to every diagram. Big text so it reads on a phone without zooming;
 * wide wrapping so 4-word labels stay on one line; the app's indigo accent.
 */
const INIT = {
  theme: 'base',
  themeVariables: {
    fontSize: '44px',
    primaryColor: '#eef2ff',
    primaryBorderColor: '#4f46e5',
    primaryTextColor: '#1c1917',
    lineColor: '#4f46e5',
    secondaryColor: '#f5f5f4',
    tertiaryColor: '#ffffff',
  },
  flowchart: { wrappingWidth: 760, nodeSpacing: 60, rankSpacing: 70, padding: 24 },
  sequence: { actorFontSize: 40, messageFontSize: 40, noteFontSize: 40 },
  mindmap: { padding: 28 },
};

/**
 * Renders Mermaid to a 1080-px-wide PNG. Kroki draws it in a real browser (so
 * fonts are right — Vercel functions have almost none); sharp then only
 * scales down and pads, never touching text.
 */
export async function renderPng(code: string): Promise<Buffer> {
  const res = await fetch(`${process.env.KROKI_URL ?? 'https://kroki.io'}/mermaid/png`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: `%%{init: ${JSON.stringify(INIT)}}%%\n${code}`,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Kroki ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const raw = Buffer.from(await res.arrayBuffer());
  const { width = 1 } = await sharp(raw).metadata();
  const inner = Math.min(width, WIDTH - PAD * 2);
  const scaled = await sharp(raw).resize({ width: inner, kernel: 'lanczos3' }).png().toBuffer();
  const { height = 1 } = await sharp(scaled).metadata();

  return sharp({ create: { width: WIDTH, height: height + PAD * 2, channels: 3, background: '#ffffff' } })
    .composite([{ input: scaled, top: PAD, left: Math.round((WIDTH - inner) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
