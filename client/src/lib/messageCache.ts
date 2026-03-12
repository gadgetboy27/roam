export interface CachedMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  pending?: boolean;
}

const CACHE_KEY = "roam_messages_v1";
const QUEUE_KEY = "roam_message_queue_v1";

function loadCache(): Record<string, CachedMessage[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CachedMessage[]>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function cacheMessages(matchId: string, messages: CachedMessage[]) {
  const cache = loadCache();
  cache[matchId] = messages;
  saveCache(cache);
}

export function getCachedMessages(matchId: string): CachedMessage[] {
  return loadCache()[matchId] ?? [];
}

export function appendCachedMessage(matchId: string, msg: CachedMessage) {
  const cache = loadCache();
  const existing = cache[matchId] ?? [];
  const idx = existing.findIndex(m => m.id === msg.id);
  if (idx === -1) {
    cache[matchId] = [...existing, msg];
  } else {
    cache[matchId] = existing.map((m, i) => i === idx ? msg : m);
  }
  saveCache(cache);
}

export function loadPendingQueue(): CachedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function enqueuePending(msg: CachedMessage) {
  const queue = loadPendingQueue();
  queue.push(msg);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function clearPendingQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
