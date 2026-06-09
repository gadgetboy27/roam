-- Per-member display nickname (shown in crews and chat instead of the real name).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname text;
