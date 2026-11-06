import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import type { RateLimitBackend, RateLimitDecision } from './rate_limit_backend.js'

/**
 * Fenêtre glissante exacte : un ensemble trié par horodatage, manipulé de façon atomique (Lua).
 * Retourne { autorisé (1/0), restant, millisecondes avant libération d'une place }.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then
    retry = tonumber(oldest[2]) + window - now
  end
  return {0, 0, retry}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, 0}
`

export class RedisRateLimitBackend implements RateLimitBackend {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'rl',
  ) {}

  async hit(
    key: string,
    nowMs: number,
    windowMs: number,
    limit: number,
  ): Promise<RateLimitDecision> {
    const reply: unknown = await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      `${this.keyPrefix}:${key}`,
      nowMs,
      windowMs,
      limit,
      `${nowMs}-${randomUUID()}`,
    )
    if (!Array.isArray(reply) || reply.length !== 3) {
      throw new Error('Réponse Redis inattendue (rate limit)')
    }
    const [allowed, remaining, retryAfterMs] = reply.map(Number)
    if (allowed === undefined || remaining === undefined || retryAfterMs === undefined) {
      throw new Error('Réponse Redis inattendue (rate limit)')
    }
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterMs: allowed === 1 ? 0 : Math.max(1, retryAfterMs),
    }
  }
}
