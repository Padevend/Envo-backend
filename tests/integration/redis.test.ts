import { randomUUID } from 'node:crypto'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLogger } from '../../app/core/logger/logger.js'
import { redisConnectionOptions } from '../../app/core/queue/connection.js'
import { createQueue, createWorker } from '../../app/core/queue/queues.js'
import { RedisRateLimitBackend } from '../../app/core/rate_limit/redis_rate_limit_backend.js'
import { INTEGRATION, requireEnv, waitFor } from '../helpers/integration.js'

// Nécessite Redis (RUN_INTEGRATION=1 et REDIS_URL). Ignoré sinon.
describe.skipIf(!INTEGRATION)('intégration Redis', () => {
  let redis: Redis

  beforeAll(() => {
    redis = new Redis(requireEnv('REDIS_URL'))
  })

  afterAll(async () => {
    await redis.quit()
  })

  describe('RedisRateLimitBackend (script Lua)', () => {
    it('refuse au-delà de la limite, puis libère une place quand la fenêtre glisse', async () => {
      const backend = new RedisRateLimitBackend(redis, `test-${randomUUID()}`)
      const windowMs = 400

      const first = []
      for (let i = 0; i < 3; i++) {
        first.push(await backend.hit('client', Date.now(), windowMs, 3))
      }
      expect(first.map((decision) => decision.allowed)).toEqual([true, true, true])
      expect(first.map((decision) => decision.remaining)).toEqual([2, 1, 0])

      const denied = await backend.hit('client', Date.now(), windowMs, 3)
      expect(denied.allowed).toBe(false)
      expect(denied.retryAfterMs).toBeGreaterThanOrEqual(1)
      expect(denied.retryAfterMs).toBeLessThanOrEqual(windowMs)

      await new Promise((resolve) => setTimeout(resolve, windowMs + 100))
      expect((await backend.hit('client', Date.now(), windowMs, 3)).allowed).toBe(true)
    })

    it('isole les clés et reste exact sous concurrence', async () => {
      const backend = new RedisRateLimitBackend(redis, `test-${randomUUID()}`)
      const decisions = await Promise.all(
        Array.from({ length: 20 }, () => backend.hit('rafale', Date.now(), 60_000, 5)),
      )
      expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5)
      expect((await backend.hit('autre', Date.now(), 60_000, 5)).allowed).toBe(true)
    })
  })

  describe('BullMQ', () => {
    it('exécute un job, puis écrit un job épuisé en file de lettres mortes', async () => {
      const deps = {
        connection: redisConnectionOptions(requireEnv('REDIS_URL')),
        prefix: `test-${randomUUID().slice(0, 8)}`,
      }
      const queue = createQueue('jobs', deps)
      const deadLetter = createQueue('dead-letter', deps)
      const processed: string[] = []
      const worker = createWorker<{ name: string }>(
        'jobs',
        async (job) => {
          if (job.data.name === 'fail') {
            throw new Error('échec voulu')
          }
          processed.push(job.data.name)
        },
        { ...deps, logger: createLogger({ level: 'silent' }), deadLetter },
      )

      try {
        await queue.add('ok', { name: 'ok' })
        await queue.add('fail', { name: 'fail' }, { attempts: 1 })
        await waitFor(async () => processed.length === 1 && (await deadLetter.getWaitingCount()) === 1, 15_000)

        expect(processed).toEqual(['ok'])
        const [dead] = await deadLetter.getJobs(['waiting'])
        expect(dead?.data).toMatchObject({ queue: 'jobs', jobName: 'fail', failedReason: 'échec voulu' })
      } finally {
        await worker.close()
        await queue.obliterate({ force: true })
        await deadLetter.obliterate({ force: true })
        await queue.close()
        await deadLetter.close()
      }
    })
  })
})
