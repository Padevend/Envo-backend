import { Hono } from 'hono'
import { providers as providerLoaders } from '../app.rc.js'
import type { AppEnv } from '../app/core/http/app_env.js'
import type { Container } from '../app/core/support/container.js'
import type { Provider } from '../app/core/support/provider.js'
import { registerKernel } from './kernel.js'
import { registerRoutes } from './routes.js'

/** Crée l'application Hono sans démarrer de serveur : testable avec `app.request()`. */
export async function createApp(container: Container): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>()
  registerKernel(app, container)

  const providers: Provider[] = []
  for (const load of providerLoaders) {
    const { default: provider } = await load()
    provider.register(container)
    providers.push(provider)
  }

  registerRoutes(app, container)

  for (const provider of providers) {
    await provider.boot?.(app, container)
  }
  return app
}
