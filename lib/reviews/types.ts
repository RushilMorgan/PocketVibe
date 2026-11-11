/** Review card shapes, shared by lib/reviews/service.ts and the review page (client-safe). */
import type { ItemRow, ReviewFormat } from '@/lib/supabase/database.types';

export type CardSave = Pick<ItemRow, 'id' | 'title' | 'url' | 'kind' | 'thumbnail_url' | 'created_at'> & { ideas: string[] };

export interface ReviewCard {
  format: ReviewFormat;
  step: number;
  save: CardSave;
  /** Then and now only: the connected save and how the two connect. */
  other?: CardSave;
  connection?: string[];
}
