-- Add missing columns to events table if they don't exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meeting_link text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS html_link text;

-- Notify PostgREST to reload the schema cache so it sees the new columns immediately
NOTIFY pgrst, 'reload config';
