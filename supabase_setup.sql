-- Run this in your Supabase project:
-- Dashboard → SQL Editor → New Query → paste → Run

-- 1. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     text NOT NULL,
  sender_id    text NOT NULL,
  content      text NOT NULL,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Presence / typing table
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  match_id    text NOT NULL,
  user_id     text NOT NULL,
  typing      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

-- 3. Enable Row Level Security (required for Realtime)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- 4. Open policies for MVP (tighten after you add Supabase Auth)
CREATE POLICY "Allow all on messages" ON public.messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on typing" ON public.typing_indicators
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime replication for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- 6. Index for fast match lookups
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id, created_at);
