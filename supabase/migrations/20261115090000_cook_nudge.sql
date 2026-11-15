-- The weekend "Cook one this week?" reminder (docs/recipes.md, second set): a new nudge kind.
-- Widens one CHECK constraint; every existing row already satisfies it.
ALTER TABLE nudges DROP CONSTRAINT nudges_kind_check;
ALTER TABLE nudges ADD CONSTRAINT nudges_kind_check
  CHECK (kind IN ('ready', 'lesson', 'review', 'midweek', 'streak', 'whatif', 'cook'));
