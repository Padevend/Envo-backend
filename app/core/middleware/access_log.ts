import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../http/app_env.js'

/** Journal d'accès : méthode, chemin (sans query string), statut, durée. Jamais d'en-têtes ni de corps. */
export function accessLogMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const startedAt = performance.now()
    await next()
    const fields = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    }
    if (c.req.path.startsWith('/health')) {
      c.get('logger').debug(fields, 'request_completed')
    } else {
      c.get('logger').info(fields, 'request_completed')
    }
  })
}
