-- Add missing columns to alarm_settings table
ALTER TABLE public.alarm_settings ADD COLUMN IF NOT EXISTS global_reminder_offset_minutes integer DEFAULT 30;
ALTER TABLE public.alarm_settings ADD COLUMN IF NOT EXISTS reminder_offsets integer[] DEFAULT '{30}';
ALTER TABLE public.alarm_settings ADD COLUMN IF NOT EXISTS default_alarm_sound text DEFAULT 'default';
ALTER TABLE public.alarm_settings ADD COLUMN IF NOT EXISTS morning_mode_enabled boolean DEFAULT false;
ALTER TABLE public.alarm_settings ADD COLUMN IF NOT EXISTS morning_mode_sound text DEFAULT 'default';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
