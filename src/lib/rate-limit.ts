const rateMap = new Map<string, { count: number; reset: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 20; // per window per IP
const CLEANUP_INTERVAL = 5 * 60_000; // 5 minutes

let lastCleanup = Date.now();

function evictExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [ip, entry] of rateMap) {
    if (now > entry.reset) rateMap.delete(ip);
  }
}

export function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  evictExpired();
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + WINDOW_MS });
    return { ok: true };
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000);
    return { ok: false, retryAfter };
  }

  return { ok: true };
}
