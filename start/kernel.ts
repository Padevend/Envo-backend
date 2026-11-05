import type { Hono } from 'hono'
import { accessLogMiddleware } from '../app/core/middleware/access_log.js'
import { bodyLimitMiddleware } from '../app/core/middleware/body_limit.js'
import { corsMiddleware } from '../app/core/middleware/cors.js'
import { createErrorHandler, createNotFoundHandler } from '../app/core/middleware/error_handler.js'
import { requestIdMiddleware } from '../app/core/middleware/request_id.js'
import { secureHeadersMiddleware } from '../app/core/middleware/secure_headers.js'
import { timeoutMiddleware } from '../app/core/middleware/timeout.js'
import type { AppEnv } from '../app/core/http/app_env.js'
import type { Container } from '../app/core/support/container.js'

/**
 * Middleware globaux, dans l'ordre d'exécution voulu :
 * request_id → access_log → secure_headers → cors → body_limit → timeout → (rate_limit, Phase 1).
 * L'error handler passe par `onError` de Hono, qui capte les erreurs de toute la chaîne.
 */
export function registerKernel(app: Hono<AppEnv>, container: Container): void {
  const config = container.make('config')

  app.use(requestIdMiddleware({ ids: container.make('ids'), logger: container.make('logger') }))
  app.use(accessLogMiddleware())
  app.use(secureHeadersMiddleware())
  app.use(corsMiddleware(config.cors.allowedOrigins))
  app.use(bodyLimitMiddleware(config.limits.bodyLimitBytes))
  app.use(timeoutMiddleware(config.limits.requestTimeoutMs))
  // TODO(phase-1) : rate_limit (Redis, fenêtre glissante)

  app.onError(createErrorHandler())
  app.notFound(createNotFoundHandler())
}
