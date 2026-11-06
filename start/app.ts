import { Hono } from 'hono'
import type { AppEnv } from '../app/core/http/app_env.js'
import type { Container } from '../app/core/support/container.js'
import { registerKernel } from './kernel.js'
import { loadProviders } from './providers.js'
import { registerRoutes } from './routes.js'

/** Crée l'application Hono sans démarrer de serveur : testable avec `app.request()`. */
export async function createApp(container: Container): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>()
  registerKernel(app, container)

  const providers = await loadProviders(container)
  registerRoutes(app, container)

  for (const provider of providers) {
    await provider.boot?.(app, container)
  }
  return app
}
