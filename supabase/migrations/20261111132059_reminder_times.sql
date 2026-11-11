-- Saves feed redesign, Phase 6 (docs/saves-redesign.md B0): when reminders may
-- be sent, as minutes after midnight South African time, on the half hour
-- between 07:00 and 21:30. One or two slots; an empty array = reminders off.
-- Default: once a day at 18:00.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_times smallint[] NOT NULL DEFAULT '{1080}';
ALTER TABLE users ADD CONSTRAINT users_reminder_times_check CHECK (
  cardinality(reminder_times) <= 2
  AND reminder_times <@ ARRAY[420,450,480,510,540,570,600,630,660,690,720,750,780,810,840,870,900,930,960,990,1020,1050,1080,1110,1140,1170,1200,1230,1260,1290]::smallint[]
);
COMMENT ON COLUMN users.reminder_times IS 'Reminder slots in minutes after midnight SAST (07:00–21:30, half-hourly), at most 2; empty = off.';
