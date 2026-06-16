-- Fix 1:1 chat: messages now persist, history loads on reopen, realtime works.
-- All statements are idempotent.
--
-- Problem on the live database:
--   public.messages had ONLY anon-scoped RLS policies (anon_insert / anon_select
--   / anon_update, all USING/CHECK true). Logged-in clients send their Supabase
--   JWT, so PostgREST runs as the `authenticated` role — which matched NO policy:
--     * INSERTs were rejected, so messages were NEVER saved (the table had 0 rows).
--     * SELECTs returned empty, so chat history vanished on reopen and Realtime
--       delivered nothing to the recipient.
--   The client (client/src/pages/matches.tsx) shows each message optimistically
--   in memory and only caches it on a successful save, so a failed insert meant
--   the message disappeared on the next reload — "messages are gone, can't reply".
--
--   Separately, public.matches had RLS enabled but NO policy, so the
--   participant-scoped message policies below — and the typing_indicators
--   policies from 0004 — would resolve to empty for authenticated users because
--   they look up the match's members. So we also let a user read their OWN
--   matches, which is correct in its own right and required by those subqueries.

-- Matches: a user may read matches they are a participant of.
DROP POLICY IF EXISTS "matches_select_own" ON public.matches;
CREATE POLICY "matches_select_own" ON public.matches FOR SELECT
  TO authenticated
  USING (auth.uid()::text IN (user_a_id, user_b_id));

-- Messages: replace the permissive anon policies with participant-scoped ones.
DROP POLICY IF EXISTS "anon_insert_messages" ON public.messages;
DROP POLICY IF EXISTS "anon_select_messages" ON public.messages;
DROP POLICY IF EXISTS "anon_update_messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select"      ON public.messages;
DROP POLICY IF EXISTS "messages_insert"      ON public.messages;
DROP POLICY IF EXISTS "messages_update"      ON public.messages;

-- Read: any participant of the match.
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid()::text IN (
    SELECT user_a_id FROM public.matches WHERE id = match_id
    UNION SELECT user_b_id FROM public.matches WHERE id = match_id));

-- Send: only as yourself, and only into a match you belong to.
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = sender_id AND auth.uid()::text IN (
    SELECT user_a_id FROM public.matches WHERE id = match_id
    UNION SELECT user_b_id FROM public.matches WHERE id = match_id));

-- Update (mark-read): a participant may update messages they did NOT send.
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid()::text IN (
    SELECT user_a_id FROM public.matches WHERE id = match_id
    UNION SELECT user_b_id FROM public.matches WHERE id = match_id)
    AND auth.uid()::text <> sender_id);
