import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** An error that maps to a specific HTTP status and a user-facing message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Wraps a route handler so thrown HttpErrors / ZodErrors become JSON
 * responses and anything unexpected is logged and returned as a 500.
 */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid request', issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  };
}
