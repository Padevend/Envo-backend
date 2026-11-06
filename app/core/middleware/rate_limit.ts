import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { problemFor } from '../exceptions/handler.js'
import type { AppEnv } from '../http/app_env.js'
import { problemResponse } from '../http/problem.js'
import type { RateLimitBackend } from '../rate_limit/rate_limit_backend.js'
import type { Clock } from '../support/clock.js'

export interface RateLimitOptions {
  backend: RateLimitBackend
  clock: Clock
  /** Nom du limiteur (préfixe de clé) : "global", plus tard "otp", "login", "payout". */
  name: string
  limit: number
  windowMs: number
  key: (c: Context<AppEnv>) => string
  skip?: (c: Context<AppEnv>) => boolean
  /**
   * Que faire si Redis est indisponible : "allow" (disponibilité, pour le limiteur global) ou
   * "deny" (sécurité, pour les limiteurs d'OTP et de PIN : on refuse plutôt que de laisser forcer).
   */
  onBackendError: 'allow' | 'deny'
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (options.skip?.(c) === true) {
      await next()
      return
    }

    let decision
    try {
      decision = await options.backend.hit(
        `${options.name}:${options.key(c)}`,
        options.clock.now().getTime(),
        options.windowMs,
        options.limit,
      )
    } catch (error) {
      c.get('logger').warn({ err: error, limiter: options.name }, 'rate_limit_backend_error')
      if (options.onBackendError === 'allow') {
        await next()
        return
      }
      return problemResponse(c, problemFor(503, c.get('requestId') ?? 'unknown'))
    }

    c.header('RateLimit-Limit', String(options.limit))
    c.header('RateLimit-Remaining', String(decision.remaining))

    if (!decision.allowed) {
      c.header('Retry-After', String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))))
      return problemResponse(c, problemFor(429, c.get('requestId') ?? 'unknown'))
    }
    await next()
  })
}
