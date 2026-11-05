import type { Hono } from 'hono'
import type { AppEnv } from '../../core/http/app_env.js'
import type { Container } from '../../core/support/container.js'
import { HealthController } from './controllers/health_controller.js'
import { HealthService } from './services/health_service.js'

/** Monté sous /health par start/routes.ts. */
export default function systemRoutes(router: Hono<AppEnv>, container: Container): void {
  const config = container.make('config')
  const service = new HealthService({
    probes: container.make('healthProbes'),
    timeoutMs: config.limits.healthProbeTimeoutMs,
    clock: container.make('clock'),
    logger: container.make('logger'),
  })
  const controller = new HealthController(service, {
    version: config.app.version,
    commit: config.app.commit,
  })

  router.get('/live', controller.live)
  router.get('/ready', controller.ready)
  router.get('/version', controller.version)
}
