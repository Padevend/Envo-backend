import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../../app/core/http/app_env.js'
import { createLogger } from '../../app/core/logger/logger.js'
import { createErrorHandler } from '../../app/core/middleware/error_handler.js'
import { rateLimitMiddleware } from '../../app/core/middleware/rate_limit.js'
import { requestIdMiddleware } from '../../app/core/middleware/request_id.js'
import type { RateLimitBackend } from '../../app/core/rate_limit/rate_limit_backend.js'
import { randomIdGenerator } from '../../app/core/support/ids.js'
import { MutableClock } from '../helpers/fakes.js'
import { InMemoryRateLimitBackend } from '../helpers/in_memory_rate_limit_backend.js'

function buildApp(
  backend: RateLimitBackend,
  clock: MutableClock,
  onBackendError: 'allow' | 'deny' = 'allow',
) {
  const app = new Hono<AppEnv>()
  app.use(requestIdMiddleware({ ids: randomIdGenerator, logger: createLogger({ level: 'silent' }) }))
  app.use(
    rateLimitMiddleware({
      backend,
      clock,
      name: 'test',
      limit: 3,
      windowMs: 60_000,
      key: (c) => c.req.header('x-client') ?? 'anonyme',
      skip: (c) => c.req.path.startsWith('/health'),
      onBackendError,
    }),
  )
  app.get('/ping', (c) => c.text('ok'))
  app.get('/health/live', (c) => c.text('ok'))
  app.onError(createErrorHandler())
  return app
}

const get = (client: string): RequestInit => ({ headers: { 'x-client': client } })
const newClock = (): MutableClock => new MutableClock(new Date('2026-01-01T00:00:00Z'))

describe('middleware de rate limit', () => {
  it('autorise jusqu\'à la limite puis répond 429 avec Retry-After', async () => {
    const app = buildApp(new InMemoryRateLimitBackend(), newClock())
    const remaining: Array<string | null> = []
    for (let i = 0; i < 3; i++) {
      const response = await app.request('/ping', get('a'))
      expect(response.status).toBe(200)
      remaining.push(response.headers.get('ratelimit-remaining'))
    }
    expect(remaining).toEqual(['2', '1', '0'])

    const blocked = await app.request('/ping', get('a'))
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
    expect(await blocked.json()).toMatchObject({ code: 'too_many_requests', status: 429 })
  })

  it('compte séparément chaque client', async () => {
    const app = buildApp(new InMemoryRateLimitBackend(), newClock())
    for (let i = 0; i < 3; i++) {
      await app.request('/ping', get('a'))
    }
    expect((await app.request('/ping', get('a'))).status).toBe(429)
    expect((await app.request('/ping', get('b'))).status).toBe(200)
  })

  it('laisse passer les chemins exclus (health)', async () => {
    const app = buildApp(new InMemoryRateLimitBackend(), newClock())
    for (let i = 0; i < 10; i++) {
      expect((await app.request('/health/live', get('a'))).status).toBe(200)
    }
  })

  it('libère des places quand la fenêtre glisse', async () => {
    const clock = newClock()
    const app = buildApp(new InMemoryRateLimitBackend(), clock)
    for (let i = 0; i < 3; i++) {
      await app.request('/ping', get('a'))
    }
    expect((await app.request('/ping', get('a'))).status).toBe(429)

    clock.advance(60_001)
    expect((await app.request('/ping', get('a'))).status).toBe(200)
  })

  describe('quand le backend est indisponible', () => {
    const failing: RateLimitBackend = {
      hit: async () => {
        throw new Error('redis indisponible')
      },
    }

    it('laisse passer en mode "allow"', async () => {
      const app = buildApp(failing, newClock(), 'allow')
      expect((await app.request('/ping', get('a'))).status).toBe(200)
    })

    it('refuse (503) en mode "deny"', async () => {
      const app = buildApp(failing, newClock(), 'deny')
      const response = await app.request('/ping', get('a'))
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ code: 'service_unavailable' })
    })
  })
})
