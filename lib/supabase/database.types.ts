/**
 * Database types for the HeyToolie tables. Hand-written (checked column-for-
 * column against `supabase gen types` on 2026-10-30) because the generator
 * types CHECK-constrained columns as plain string; these keep the literal
 * unions. Legacy tables from the old site are deliberately left out.
 * When a migration changes a table, update the matching Row type here.
 */

export type ItemSource = 'youtube' | 'article' | 'tiktok' | 'other';
export type ItemKind = 'recipe' | 'tech' | 'news' | 'other';
export type ItemStatus = 'queued' | 'processing' | 'done' | 'failed';
export type OutputType = 'recipe' | 'explainer' | 'diagram' | 'lesson';
export type EventType = 'saved' | 'opened' | 'played' | 'score' | 'thumbs' | 'digest_open';
export type Level = 'beginner' | 'some-code' | 'dev';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Builds the Row/Insert/Update triple postgrest-js expects. */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  level: Level;
  tone: string;
  created_at: string;
  updated_at: string;
}

export type ItemRow = {
  id: string;
  user_id: string;
  url: string;
  source: ItemSource;
  kind: ItemKind | null;
  title: string | null;
  status: ItemStatus;
  error: string | null;
  raw_text: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export type ItemOutputRow = {
  id: string;
  item_id: string;
  user_id: string;
  type: OutputType;
  content: Json;
  file_url: string | null;
  created_at: string;
}

export type ChunkRow = {
  id: string;
  item_id: string;
  user_id: string;
  text: string;
  /** pgvector is sent/received as its text form, e.g. "[0.1,0.2,…]". */
  embedding: string;
  created_at: string;
}

export type TopicRow = {
  id: string;
  user_id: string;
  name: string;
  embedding: string | null;
  weight: number;
  last_seen_at: string;
  created_at: string;
}

export type ItemTopicRow = {
  item_id: string;
  topic_id: string;
  user_id: string;
}

export type EventRow = {
  id: string;
  user_id: string;
  item_id: string | null;
  type: EventType;
  value: number | null;
  created_at: string;
}

export type PushDeviceRow = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export type DigestRow = {
  id: string;
  user_id: string;
  week_start: string;
  content: Json;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
}

export type AllowedEmailRow = {
  email: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow, 'id' | 'email'>;
      items: Table<ItemRow, 'user_id' | 'url' | 'source'>;
      item_outputs: Table<ItemOutputRow, 'item_id' | 'user_id' | 'type' | 'content'>;
      chunks: Table<ChunkRow, 'item_id' | 'user_id' | 'text' | 'embedding'>;
      topics: Table<TopicRow, 'user_id' | 'name'>;
      item_topics: Table<ItemTopicRow, 'item_id' | 'topic_id' | 'user_id'>;
      events: Table<EventRow, 'user_id' | 'type'>;
      push_devices: Table<PushDeviceRow, 'endpoint' | 'user_id' | 'p256dh' | 'auth'>;
      allowed_emails: Table<AllowedEmailRow, 'email'>;
      digests: Table<DigestRow, 'user_id' | 'week_start' | 'content'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      match_chunks: {
        Args: { p_user_id: string; p_embedding: string; p_match_count?: number; p_exclude_item?: string };
        Returns: { id: string; item_id: string; text: string; similarity: number }[];
      };
      match_topic: {
        Args: { p_user_id: string; p_embedding: string };
        Returns: { id: string; name: string; similarity: number }[];
      };
      adjust_topic_weight: {
        Args: { p_topic_id: string; p_delta: number };
        Returns: undefined;
      };
      take_public_tool_use: {
        Args: { p_visitor: string; p_tool: string; p_day: string; p_limit: number };
        Returns: boolean;
      };
      refund_public_tool_use: {
        Args: { p_visitor: string; p_tool: string; p_day: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
