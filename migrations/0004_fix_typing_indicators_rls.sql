-- Fix typing-indicator 403s for signed-in users. All statements are idempotent.
--
-- Problem on the live database:
--   The only RLS policy on public.typing_indicators was `anon_all_typing_indicators`
--   (TO anon, USING true). Logged-in clients send their Supabase user JWT, so
--   PostgREST runs the setTyping() upsert as the `authenticated` role — which
--   matched NO policy, so every upsert returned 403. The typing indicator never
--   worked for real (signed-in) users, and the Supabase security advisor also
--   flagged the permissive anon policy.
--
-- Fix:
--   Replace it with participant-scoped policies that mirror the working
--   public.messages policies:
--     * SELECT  — any participant of the match (so the OTHER person's typing
--                 row is delivered over Realtime; a self-only read would hide it).
--     * INSERT / UPDATE — a user may only write their own typing row.
--   (The upsert in client/src/lib/supabase.ts needs both INSERT and UPDATE.)

-- Drop every prior variant so this is safe to re-run.
DROP POLICY IF EXISTS "anon_all_typing_indicators" ON public.typing_indicators;
DROP POLICY IF EXISTS "Allow all on typing"        ON public.typing_indicators;
DROP POLICY IF EXISTS "typing_all"                 ON public.typing_indicators;
DROP POLICY IF EXISTS "typing_select"              ON public.typing_indicators;
DROP POLICY IF EXISTS "typing_insert"              ON public.typing_indicators;
DROP POLICY IF EXISTS "typing_update"              ON public.typing_indicators;

-- Read: any participant of the match may see typing rows.
CREATE POLICY "typing_select" ON public.typing_indicators FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text IN (
      SELECT user_a_id FROM public.matches WHERE id = match_id
      UNION
      SELECT user_b_id FROM public.matches WHERE id = match_id
    )
  );

-- Write: a user may only upsert their own typing row.
CREATE POLICY "typing_insert" ON public.typing_indicators FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "typing_update" ON public.typing_indicators FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
