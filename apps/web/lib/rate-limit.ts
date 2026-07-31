type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const globalRateLimits = globalThis as typeof globalThis & {
  attentionBidRateLimits?: Map<string, RateLimitEntry>;
};

const entries =
  globalRateLimits.attentionBidRateLimits ??
  (globalRateLimits.attentionBidRateLimits = new Map());

function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export function checkRateLimit(
  request: Request,
  { key, limit, windowMs }: RateLimitOptions
) {
  const now = Date.now();
  const entryKey = `${key}:${getClientAddress(request)}`;
  const current = entries.get(entryKey);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    entries.set(entryKey, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  current.count += 1;

  if (entries.size > 10_000) {
    for (const [candidateKey, candidate] of entries) {
      if (candidate.resetAt <= now) entries.delete(candidateKey);
    }
  }

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return Response.json(
    {
      success: false,
      message: "Too many requests. Please wait and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}
