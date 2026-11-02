import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { answer, chatRequest, clearChat, listChat } from '@/lib/chat';
import { route } from '@/lib/http';

export const maxDuration = 60;

const threadQuery = z.object({ itemId: z.uuid().optional() });

/** The saved thread: an item's (?itemId=…) or the library-wide Ask (no itemId). */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { itemId } = threadQuery.parse({ itemId: req.nextUrl.searchParams.get('itemId') ?? undefined });
  return NextResponse.json({ messages: await listChat(user.id, itemId) });
});

/** Clear a thread. */
export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { itemId } = threadQuery.parse({ itemId: req.nextUrl.searchParams.get('itemId') ?? undefined });
  await clearChat(user.id, itemId);
  return NextResponse.json({ ok: true });
});

/**
 * Streams a plain-text answer and saves it when the stream ends (or whatever
 * arrived, if it breaks or the reader leaves). The numbered sources it may
 * cite ([1], [2]…) come up front in the X-Sources header (URI-encoded JSON).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { sources, stream, finish } = await answer(user.id, chatRequest.parse(await req.json()));
  const encoder = new TextEncoder();
  let text = '';
  let saved = false;
  const save = async () => {
    if (saved) return;
    saved = true;
    await finish(text).catch((err) => console.error('chat: saving the answer failed', err));
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await stream.next();
        if (done) {
          await save();
          controller.close();
          return;
        }
        text += value;
        controller.enqueue(encoder.encode(value));
      } catch (err) {
        console.error('chat stream failed', err);
        const note = '\n\n(Sorry — the answer was cut off. Try again.)';
        text += note;
        controller.enqueue(encoder.encode(note));
        await save();
        controller.close();
      }
    },
    async cancel() {
      await stream.return(undefined);
      await save();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Sources': encodeURIComponent(JSON.stringify(sources)),
    },
  });
});
