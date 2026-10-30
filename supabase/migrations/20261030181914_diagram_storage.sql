-- Public bucket for rendered diagram PNGs (SPEC Phase 2). Paths are
-- <user_id>/<item_id>/<uuid>.png, so URLs are unguessable; public read keeps
-- them fast to load and easy to share. Only the service role writes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('diagrams', 'diagrams', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;
