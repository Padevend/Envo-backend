import { Hono } from 'hono'
import type { AppEnv } from '../app/core/http/app_env.js'
import type { Container } from '../app/core/support/container.js'
import systemRoutes from '../app/modules/system/routes.js'

/** Monte les routes de chaque module sous son préfixe. */
export function registerRoutes(app: Hono<AppEnv>, container: Container): void {
  const health = new Hono<AppEnv>()
  systemRoutes(health, container)
  app.route('/health', health)

  // Phases suivantes : /v1 (mobile), /admin (back-office, auth distincte),
  // /webhooks (sans auth utilisateur, signature obligatoire).
}
