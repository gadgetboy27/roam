import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  "https://znqbnldsalsfpraiplxz.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
