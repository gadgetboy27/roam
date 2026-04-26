import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 10 } } }
);

export interface SupabaseMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export async function fetchMessages(matchId: string): Promise<SupabaseMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[supabase] fetchMessages error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function sendSupabaseMessage(
  matchId: string,
  senderId: string,
  content: string
): Promise<SupabaseMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id: senderId, content })
    .select()
    .single();
  if (error) {
    console.error("[supabase] sendMessage error:", error.message);
    return null;
  }
  return data;
}

export async function markMessagesRead(matchId: string, senderId: string) {
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("match_id", matchId)
    .neq("sender_id", senderId);
}

export async function setTyping(matchId: string, userId: string, typing: boolean) {
  await supabase.from("typing_indicators").upsert(
    { match_id: matchId, user_id: userId, typing, updated_at: new Date().toISOString() },
    { onConflict: "match_id,user_id" }
  );
}

export function subscribeToMessages(
  matchId: string,
  onMessage: (msg: SupabaseMessage) => void
) {
  return supabase
    .channel(`messages:${matchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
      (payload) => onMessage(payload.new as SupabaseMessage)
    )
    .subscribe();
}

export function subscribeToTyping(
  matchId: string,
  userId: string,
  onTyping: (isTyping: boolean, whoId: string) => void
) {
  return supabase
    .channel(`typing:${matchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "typing_indicators", filter: `match_id=eq.${matchId}` },
      (payload) => {
        const row = payload.new as { user_id: string; typing: boolean };
        if (row.user_id !== userId) onTyping(row.typing, row.user_id);
      }
    )
    .subscribe();
}
