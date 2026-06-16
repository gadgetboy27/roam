-- "Almost Met" source data: places a user has actually been. Idempotent.
--
-- Two users who logged the same place (and roughly the same time) almost crossed
-- paths — that's the signature "Almost Met" signal on Discover. Until now it was
-- only guessed from a hardcoded list of place names found in photo captions, so
-- it was empty for almost everyone. This table lets users record places directly.

CREATE TABLE IF NOT EXISTS public.visited_places (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     varchar NOT NULL,
  place       text NOT NULL,
  year        integer,            -- optional; sharpens the "when"
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visited_places_user ON public.visited_places(user_id);

-- Lock the table down: the server reaches it with the service role (which
-- bypasses RLS), and clients only ever touch it through the app API — never the
-- public REST endpoint. RLS-on + no policy = no anon/authenticated REST access.
ALTER TABLE public.visited_places ENABLE ROW LEVEL SECURITY;

-- Auto-clean on user deletion (belt-and-suspenders with the app-level
-- deleteUser() cascade).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_visited_places_user'
                   AND table_name = 'visited_places') THEN
    ALTER TABLE public.visited_places
      ADD CONSTRAINT fk_visited_places_user
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
