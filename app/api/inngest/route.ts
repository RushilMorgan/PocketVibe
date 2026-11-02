import { serve } from 'inngest/next';
import { inngest } from '@/lib/jobs/client';
import { functions } from '@/lib/jobs/functions';

// Video steps can take a while; Inngest re-invokes per step, so this is per step.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
