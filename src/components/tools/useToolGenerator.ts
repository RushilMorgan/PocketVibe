import { useCallback, useState } from 'react';
import { generateCreation, QuotaExceededError } from '../../services/aiService';
import { normalizeGenerateResponse } from '../../lib/normalizeResponse';
import type { GenerateRequest, CreationContent, CreationType } from '../../types';

interface QuotaNotice {
  kind: 'generation' | 'chat';
  tier: string;
  resetsAt: string;
}

/**
 * Generic, reducer-free generation for standalone tool pages. Tools that just
 * "take text → generate a creation → improve it" share this instead of adding a
 * bespoke pair of functions to usePocketVibe (which RULES keeps from growing).
 *
 * `generate` builds a fresh creation of `forcedType`; `customize` runs a
 * whole-creation improve. Both return the validated content (caller casts to its
 * concrete type) or null on failure; quota errors surface via `quotaNotice`.
 */
export function useToolGenerator() {
  const [quotaNotice, setQuotaNotice] = useState<QuotaNotice | null>(null);

  function locale() {
    return {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  const generate = useCallback(async (
    forcedType: CreationType,
    userRequest: string,
  ): Promise<CreationContent | null> => {
    const req: GenerateRequest = { userRequest, mode: 'new', locale: locale(), forcedType };
    try {
      const res = await generateCreation(req);
      const safe = normalizeGenerateResponse(res, req) ?? res;
      if (safe.creationType !== forcedType || safe.content.type !== forcedType) return null;
      return safe.content as CreationContent;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaNotice({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt });
      }
      return null;
    }
  }, []);

  const customize = useCallback(async (
    forcedType: CreationType,
    content: CreationContent,
    title: string,
    message: string,
  ): Promise<CreationContent | null> => {
    const req: GenerateRequest = {
      userRequest: message,
      mode: 'improve',
      forcedType,
      currentCreation: {
        id: 'tool', title: title || 'Tool', creationType: forcedType,
        content, originalRequest: '', version: 1,
      },
      locale: locale(),
    };
    try {
      const res = await generateCreation(req);
      const safe = normalizeGenerateResponse(res, req) ?? res;
      if (safe.creationType !== forcedType || safe.content.type !== forcedType) return null;
      return safe.content as CreationContent;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaNotice({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt });
      }
      return null;
    }
  }, []);

  return { generate, customize, quotaNotice, dismissQuotaNotice: () => setQuotaNotice(null) };
}
