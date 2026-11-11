-- The user's time zone (IANA name, e.g. 'Europe/London'), reported by their
-- phone. Reminder slots, the streak's "today" and the feed's week are all
-- local to it. Existing users start on South African time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Johannesburg';
COMMENT ON COLUMN users.timezone IS 'IANA time zone from the user''s device; reminders, streak days and the week are local to it.';
