import { requireUser } from '@/lib/auth';
import { answer, chatRequest } from '@/lib/chat';
import { route } from '@/lib/http';

export const maxDuration = 60;

/**
 * Streams a plain-text answer. The numbered sources it may cite ([1], [2]…)
 * come up front in the X-Sources header (URI-encoded JSON).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { sources, stream } = await answer(user.id, chatRequest.parse(await req.json()));
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await stream.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        console.error('chat stream failed', err);
        controller.enqueue(encoder.encode('\n\n(Sorry — the answer was cut off. Try again.)'));
        controller.close();
      }
    },
    async cancel() {
      await stream.return(undefined);
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
