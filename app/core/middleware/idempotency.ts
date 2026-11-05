import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { sha256Hex } from '../crypto/hash.js'
import { HttpException } from '../exceptions/http_exception.js'
import type { AppEnv } from '../http/app_env.js'
import type { IdempotencyRef, IdempotencyStore } from '../idempotency/idempotency_store.js'
import type { Clock } from '../support/clock.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface IdempotencyOptions {
  store: IdempotencyStore
  clock: Clock
  /** Identifiant de l'utilisateur authentifié ; `undefined` = pas d'identité → 401. */
  resolveScope: (c: Context<AppEnv>) => string | undefined
  ttlMs: number
  lockTimeoutMs?: number
}

const DEFAULT_LOCK_TIMEOUT_MS = 60_000

/**
 * Idempotence HTTP des commandes financières : exige `Idempotency-Key` (UUID), verrouille la clé,
 * rejette (422) la même clé avec un corps différent, rejoue la réponse stockée si la requête est terminée,
 * répond 409 si elle est encore en cours. Les erreurs serveur (5xx) libèrent le verrou : le client peut réessayer.
 */
export function idempotencyMiddleware(options: IdempotencyOptions) {
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS

  return createMiddleware<AppEnv>(async (c, next) => {
    const rawKey = c.req.header('idempotency-key')
    if (rawKey === undefined) {
      throw new HttpException({
        status: 400,
        code: 'idempotency_key_required',
        title: 'En-tête Idempotency-Key requis',
      })
    }
    if (!UUID_PATTERN.test(rawKey)) {
      throw new HttpException({
        status: 400,
        code: 'idempotency_key_invalid',
        title: 'Idempotency-Key invalide',
        detail: 'La clé doit être un UUID.',
      })
    }
    const scope = options.resolveScope(c)
    if (scope === undefined) {
      throw new HttpException({ status: 401, code: 'unauthorized', title: 'Authentification requise' })
    }

    const url = new URL(c.req.url)
    const body = await c.req.text()
    const ref: IdempotencyRef = {
      scope,
      key: rawKey.toLowerCase(),
      endpoint: `${c.req.method} ${url.pathname}`,
    }
    const requestHash = sha256Hex(`${c.req.method}\n${url.pathname}${url.search}\n${body}`)

    const result = await options.store.begin({
      ...ref,
      requestHash,
      now: options.clock.now(),
      ttlMs: options.ttlMs,
      lockTimeoutMs,
    })

    if (result.state === 'replay') {
      c.header('Idempotency-Replayed', 'true')
      return c.newResponse(result.response.body, result.response.status as ContentfulStatusCode, {
        'Content-Type': result.response.contentType,
      })
    }
    if (result.state === 'in_progress') {
      c.header('Retry-After', '1')
      throw new HttpException({
        status: 409,
        code: 'idempotency_in_progress',
        title: 'Requête déjà en cours de traitement',
      })
    }
    if (result.state === 'mismatch') {
      throw new HttpException({
        status: 422,
        code: 'idempotency_key_reused',
        title: 'Idempotency-Key déjà utilisée avec une requête différente',
      })
    }

    c.set('idempotency', { key: ref.key })
    await next()

    // Hono convertit les erreurs levées en aval en réponse : on lit donc le statut final.
    const response = c.res
    try {
      if (response.status >= 500) {
        await options.store.release(ref)
        return
      }
      await options.store.complete(
        ref,
        {
          status: response.status,
          contentType: response.headers.get('content-type') ?? 'application/json',
          body: await response.clone().text(),
        },
        options.clock.now(),
      )
    } catch (error) {
      // Le verrou expirera (lockTimeoutMs) : mieux vaut répondre que perdre une opération réussie.
      c.get('logger').warn({ err: error }, 'idempotency_store_failed')
    }
  })
}
