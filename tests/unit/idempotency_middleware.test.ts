import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createErrorHandler } from '../../app/core/middleware/error_handler.js'
import { idempotencyMiddleware } from '../../app/core/middleware/idempotency.js'
import { requestIdMiddleware } from '../../app/core/middleware/request_id.js'
import { createLogger } from '../../app/core/logger/logger.js'
import type { AppEnv } from '../../app/core/http/app_env.js'
import type { Context } from 'hono'
import { systemClock } from '../../app/core/support/clock.js'
import { randomIdGenerator } from '../../app/core/support/ids.js'
import { InMemoryIdempotencyStore } from '../helpers/in_memory_idempotency_store.js'

const KEY = '3f8c2f6e-5b1a-4c8e-9d3a-7a1b2c3d4e5f'
const OTHER_KEY = '9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d'
const BODY = JSON.stringify({ amount: '5000' })

type Handler = (c: Context<AppEnv>) => Response | Promise<Response>

function buildApp(store: InMemoryIdempotencyStore, handler: Handler) {
  const app = new Hono<AppEnv>()
  app.use(requestIdMiddleware({ ids: randomIdGenerator, logger: createLogger({ level: 'silent' }) }))
  app.onError(createErrorHandler())
  app.use(
    '/pay',
    idempotencyMiddleware({
      store,
      clock: systemClock,
      resolveScope: (c) => c.req.header('x-test-user'),
      ttlMs: 60_000,
    }),
  )
  app.post('/pay', handler)
  return app
}

function post(key: string | undefined, body: string = BODY, user: string | undefined = 'user-1'): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key === undefined ? {} : { 'idempotency-key': key }),
      ...(user === undefined ? {} : { 'x-test-user': user }),
    },
    body,
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('middleware d\'idempotence', () => {
  it('exige l\'en-tête Idempotency-Key', async () => {
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => c.json({ ok: true }, 201))
    const response = await app.request('/pay', post(undefined))
    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({ code: 'idempotency_key_required' })
  })

  it('refuse une clé qui n\'est pas un UUID', async () => {
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => c.json({ ok: true }, 201))
    const response = await app.request('/pay', post('pas-un-uuid'))
    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({ code: 'idempotency_key_invalid' })
  })

  it('refuse une requête sans identité (401)', async () => {
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => c.json({ ok: true }, 201))
    const response = await app.request('/pay', post(KEY, BODY, undefined))
    expect(response.status).toBe(401)
  })

  it('exécute l\'opération une seule fois et rejoue la réponse', async () => {
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), async (c) => {
      calls++
      const body = await c.req.json<{ amount: string }>()
      return c.json({ amount: body.amount, call: calls }, 201)
    })

    const first = await app.request('/pay', post(KEY))
    const second = await app.request('/pay', post(KEY))

    expect(calls).toBe(1)
    expect(first.status).toBe(201)
    expect(first.headers.get('idempotency-replayed')).toBeNull()
    expect(second.status).toBe(201)
    expect(second.headers.get('idempotency-replayed')).toBe('true')
    expect(await readJson(second)).toEqual({ amount: '5000', call: 1 })
  })

  it('rejette la même clé avec un corps différent (422)', async () => {
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => {
      calls++
      return c.json({ ok: true }, 201)
    })
    await app.request('/pay', post(KEY))
    const response = await app.request('/pay', post(KEY, JSON.stringify({ amount: '9999' })))

    expect(response.status).toBe(422)
    expect(await readJson(response)).toMatchObject({ code: 'idempotency_key_reused' })
    expect(calls).toBe(1)
  })

  it('répond 409 pendant qu\'une requête identique est en cours, puis rejoue le résultat', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), async (c) => {
      calls++
      await gate
      return c.json({ ok: true }, 201)
    })

    const first = app.request('/pay', post(KEY))
    await tick()
    const concurrent = await app.request('/pay', post(KEY))
    expect(concurrent.status).toBe(409)
    expect(await readJson(concurrent)).toMatchObject({ code: 'idempotency_in_progress' })

    release()
    expect((await first).status).toBe(201)
    const replay = await app.request('/pay', post(KEY))
    expect(replay.status).toBe(201)
    expect(replay.headers.get('idempotency-replayed')).toBe('true')
    expect(calls).toBe(1)
  })

  it('libère le verrou après une erreur serveur : le client peut réessayer', async () => {
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => {
      calls++
      if (calls === 1) {
        throw new Error('panne interne')
      }
      return c.json({ ok: true }, 201)
    })

    const failed = await app.request('/pay', post(KEY))
    expect(failed.status).toBe(500)
    const retried = await app.request('/pay', post(KEY))
    expect(retried.status).toBe(201)
    expect(calls).toBe(2)
  })

  it('mémorise aussi un refus métier (4xx) sans réexécuter', async () => {
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => {
      calls++
      return c.json({ code: 'insufficient_funds' }, 422)
    })
    await app.request('/pay', post(KEY))
    const replay = await app.request('/pay', post(KEY))
    expect(replay.status).toBe(422)
    expect(replay.headers.get('idempotency-replayed')).toBe('true')
    expect(calls).toBe(1)
  })

  it('isole les utilisateurs et les clés', async () => {
    let calls = 0
    const app = buildApp(new InMemoryIdempotencyStore(), (c) => {
      calls++
      return c.json({ calls }, 201)
    })
    await app.request('/pay', post(KEY, BODY, 'user-1'))
    await app.request('/pay', post(KEY, BODY, 'user-2'))
    await app.request('/pay', post(OTHER_KEY, BODY, 'user-1'))
    expect(calls).toBe(3)
  })
})
