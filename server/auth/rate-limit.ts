type Counter = { count: number; resetsAt: number };

const counters = new Map<string, Counter>();

export function getRequestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = counters.get(key);
  if (!current || current.resetsAt <= now) {
    counters.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
