import type {
  RateLimitBackend,
  RateLimitDecision,
} from '../../app/core/rate_limit/rate_limit_backend.js'

/** Même sémantique que le script Lua (fenêtre glissante exacte), en mémoire. */
export class InMemoryRateLimitBackend implements RateLimitBackend {
  readonly #hits = new Map<string, number[]>()

  async hit(
    key: string,
    nowMs: number,
    windowMs: number,
    limit: number,
  ): Promise<RateLimitDecision> {
    const recent = (this.#hits.get(key) ?? []).filter((timestamp) => timestamp > nowMs - windowMs)
    if (recent.length >= limit) {
      this.#hits.set(key, recent)
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, (recent[0] ?? nowMs) + windowMs - nowMs),
      }
    }
    recent.push(nowMs)
    this.#hits.set(key, recent)
    return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 }
  }
}

/** Limiteur qui laisse tout passer : valeur par défaut des tests qui ne portent pas sur le rate limit. */
export const unlimitedBackend: RateLimitBackend = {
  hit: async (_key, _nowMs, _windowMs, limit) => ({
    allowed: true,
    remaining: limit,
    retryAfterMs: 0,
  }),
}
