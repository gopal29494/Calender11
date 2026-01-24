-- Add reminder_offsets column to events table to allow per-event overrides
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS reminder_offsets int[];

-- Comment: If reminder_offsets is NULL, it means "use global default". 
-- If it is an empty array [], it means "no reminders".
-- If it has values [5, 10], it means specific reminders.
