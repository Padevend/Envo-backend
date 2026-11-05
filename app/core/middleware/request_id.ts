import { createMiddleware } from 'hono/factory'
import type { Logger } from 'pino'
import type { AppEnv } from '../http/app_env.js'
import type { IdGenerator } from '../support/ids.js'

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

/** Identifiant de corrélation : repris s'il est sain, sinon généré. Associe un logger enfant à la requête. */
export function requestIdMiddleware(deps: { ids: IdGenerator; logger: Logger }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const incoming = c.req.header('x-request-id')
    const requestId =
      incoming !== undefined && VALID_REQUEST_ID.test(incoming) ? incoming : deps.ids.uuid()
    c.set('requestId', requestId)
    c.set('logger', deps.logger.child({ requestId }))
    c.header('X-Request-Id', requestId)
    await next()
  })
}
