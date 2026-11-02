-- Per-user choice of the "smart" model (explainers, lessons, diagrams, chat),
-- picked in Settings. null = the GEMINI_MODEL_PRO default.
ALTER TABLE users ADD COLUMN IF NOT EXISTS smart_model text;
COMMENT ON COLUMN users.smart_model IS 'Gemini model for explainers, lessons, diagrams and chat; null = the GEMINI_MODEL_PRO default. Validated in lib/ai/models.ts.';
