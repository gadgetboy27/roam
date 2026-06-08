-- Fix 1:1 chat delivery + notifications. All statements are idempotent.
--
-- Problems this fixes on the live database:
--   1. The `supabase_realtime` publication had NO tables, so the recipient's
--      live message subscription never received anything — texts never arrived
--      in realtime for the other user.
--   2. The `messages.read` column existed in the app schema but was never
--      applied to the DB, so marking messages read failed silently.
--   3. Nothing created a notification when a 1:1 message was inserted, so the
--      bell badge never lit up. (1:1 chat writes straight to Supabase, bypassing
--      the app server, so this must live in the database as a trigger.)

-- 1. Add the missing read column ------------------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- 2. Publish the chat tables to Supabase Realtime ------------------------------
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='typing_indicators') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  END IF;
END $$;

-- 3. Create a bell notification for the recipient of every new 1:1 message ------
--    Deduped: one unread "message" notification per match until it is read.
CREATE OR REPLACE FUNCTION public.notify_new_message() RETURNS trigger AS $$
DECLARE
  m            RECORD;
  recipient_id varchar;
  sender_name  text;
BEGIN
  SELECT user_a_id, user_b_id INTO m FROM public.matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF m.user_a_id = NEW.sender_id THEN
    recipient_id := m.user_b_id;
  ELSE
    recipient_id := m.user_a_id;
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.notifications
             WHERE user_id = recipient_id AND type = 'message' AND is_read = false
               AND data LIKE '%"matchId":"' || NEW.match_id || '"%') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM public.users WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    recipient_id,
    'message',
    COALESCE('New message from ' || sender_name, 'New message'),
    left(NEW.content, 80),
    -- Match JSON.stringify format exactly (no spaces) so the dedupe LIKE above
    -- and the client's JSON.parse both work consistently.
    '{"matchId":"' || NEW.match_id || '"}',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
