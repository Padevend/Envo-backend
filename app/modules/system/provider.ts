import type { Provider } from '../../core/support/provider.js'
import { HealthRepository } from './repositories/health_repository.js'

const provider: Provider = {
  name: 'system',
  register(container) {
    // Les tests peuvent pré-lier leurs propres sondes avant le chargement des providers.
    if (container.has('healthProbes')) {
      return
    }
    container.bind('healthProbes', (c) => {
      const repository = new HealthRepository(c.make('prisma'), c.make('redis'))
      return [
        { name: 'postgres', check: () => repository.pingDatabase() },
        { name: 'redis', check: () => repository.pingRedis() },
      ]
    })
  },
}

export default provider
