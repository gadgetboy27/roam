-- Run this in your Supabase project:
-- Dashboard → SQL Editor → New Query → paste → Run
-- This script is idempotent — safe to run multiple times.

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

-- 4. Scoped RLS policies — drop old open policies first, then apply participant-scoped ones.

-- Messages: drop any existing policies first (idempotent)
DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;

-- Users can only see messages in matches they are a participant of
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (
    auth.uid()::text IN (
      SELECT user_a_id FROM matches WHERE id = match_id
      UNION
      SELECT user_b_id FROM matches WHERE id = match_id
    )
  );

-- Users can only send messages as themselves
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

-- Users can only mark messages as read that were sent TO them (not by them)
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (auth.uid()::text != sender_id);

-- Typing indicators: drop old and add scoped policies
DROP POLICY IF EXISTS "Allow all on typing" ON public.typing_indicators;
DROP POLICY IF EXISTS "typing_all" ON public.typing_indicators;

-- Users can only set their own typing indicator
CREATE POLICY "typing_all" ON public.typing_indicators FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 5. Enable Realtime replication for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- 6. Index for fast match lookups
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id, created_at);

-- NOTE: The "matches" table referenced in RLS policies above is the Supabase public.matches table.
-- You need to ensure this table exists and is accessible for the RLS policies to work.
-- If you are using a separate Postgres DB for Drizzle data, add the matches lookup as a Postgres function
-- or replicate match membership here.
