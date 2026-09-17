const buckets = new Map<string, { count: number; resetAt: number }>();

/** Per-process token bucket — each instance keeps its own, so a multi-instance serverless deploy effectively multiplies the limit. */
export function checkRateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
