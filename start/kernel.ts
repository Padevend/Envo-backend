import type { Hono } from 'hono'
import type { AppEnv } from '../app/core/http/app_env.js'
import { clientIp } from '../app/core/http/client_ip.js'
import { accessLogMiddleware } from '../app/core/middleware/access_log.js'
import { bodyLimitMiddleware } from '../app/core/middleware/body_limit.js'
import { corsMiddleware } from '../app/core/middleware/cors.js'
import { createErrorHandler, createNotFoundHandler } from '../app/core/middleware/error_handler.js'
import { rateLimitMiddleware } from '../app/core/middleware/rate_limit.js'
import { requestIdMiddleware } from '../app/core/middleware/request_id.js'
import { secureHeadersMiddleware } from '../app/core/middleware/secure_headers.js'
import { timeoutMiddleware } from '../app/core/middleware/timeout.js'
import type { Container } from '../app/core/support/container.js'

/**
 * Middleware globaux, dans l'ordre d'exécution voulu :
 * request_id → access_log → secure_headers → cors → body_limit → timeout → rate_limit.
 * L'error handler passe par `onError` de Hono, qui capte les erreurs de toute la chaîne.
 * L'idempotence n'est pas globale : elle s'applique route par route aux POST financiers.
 */
export function registerKernel(app: Hono<AppEnv>, container: Container): void {
  const config = container.make('config')

  app.use(requestIdMiddleware({ ids: container.make('ids'), logger: container.make('logger') }))
  app.use(accessLogMiddleware())
  app.use(secureHeadersMiddleware())
  app.use(corsMiddleware(config.cors.allowedOrigins))
  app.use(bodyLimitMiddleware(config.limits.bodyLimitBytes))
  app.use(timeoutMiddleware(config.limits.requestTimeoutMs))
  app.use(
    rateLimitMiddleware({
      backend: container.make('rateLimitBackend'),
      clock: container.make('clock'),
      name: 'global',
      limit: config.limits.rateLimitGlobalPerMinute,
      windowMs: 60_000,
      key: (c) => clientIp(c, config.security.trustProxy),
      skip: (c) => c.req.path.startsWith('/health'),
      onBackendError: 'allow',
    }),
  )

  app.onError(createErrorHandler())
  app.notFound(createNotFoundHandler())
}
