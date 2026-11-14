-- What if… (docs/what-if.md Parts B and C).
-- One new column, and four CHECK constraints widened to allow new values. Nothing is deleted or
-- rewritten: every existing row already satisfies the wider rules.

-- The scenario question the classifier chose for this save; NULL = no sensible what-if.
ALTER TABLE items ADD COLUMN IF NOT EXISTS what_if text;

ALTER TABLE item_outputs DROP CONSTRAINT item_outputs_type_check;
ALTER TABLE item_outputs ADD CONSTRAINT item_outputs_type_check
  CHECK (type IN ('recipe', 'explainer', 'diagram', 'lesson', 'whatif'));

ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('saved', 'opened', 'played', 'score', 'thumbs', 'digest_open',
                  'whatif_open', 'whatif_scenario', 'whatif_signal'));

-- Reminders: "a what-if is waiting" takes the lesson slot; the ready push gains a What if button.
ALTER TABLE nudges DROP CONSTRAINT nudges_kind_check;
ALTER TABLE nudges ADD CONSTRAINT nudges_kind_check
  CHECK (kind IN ('ready', 'lesson', 'review', 'midweek', 'streak', 'whatif'));

ALTER TABLE nudges DROP CONSTRAINT nudges_action_check;
ALTER TABLE nudges ADD CONSTRAINT nudges_action_check
  CHECK (action IN ('open', 'read', 'play', 'whatif'));
