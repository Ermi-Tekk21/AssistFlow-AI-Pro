import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, options.windowMs);

  // Unref ensures timer does not block Node process exit in unit tests
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key =
      (req.headers["x-user-id"] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      "anonymous";

    const now = Date.now();
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", options.max - 1);
      next();
      return;
    }

    if (existing.count >= options.max) {
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("Retry-After", Math.ceil((existing.resetAt - now) / 1000));
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: options.message || "Too many requests, please slow down.",
        },
      });
      return;
    }

    existing.count += 1;
    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", options.max - existing.count);
    next();
  };
}
