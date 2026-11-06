import { providers as providerLoaders } from '../app.rc.js'
import type { Container } from '../app/core/support/container.js'
import type { Provider } from '../app/core/support/provider.js'

/** Charge les providers dans l'ordre d'app.rc.ts et appelle `register` sur chacun. */
export async function loadProviders(container: Container): Promise<Provider[]> {
  const providers: Provider[] = []
  for (const load of providerLoaders) {
    const { default: provider } = await load()
    provider.register(container)
    providers.push(provider)
  }
  return providers
}
