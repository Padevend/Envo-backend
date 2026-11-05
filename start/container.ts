import { createPrismaClient } from '../app/core/database/prisma_client.js'
import { createRedisClient } from '../app/core/database/redis_client.js'
import { createLogger } from '../app/core/logger/logger.js'
import { systemClock } from '../app/core/support/clock.js'
import { Container, type Registry } from '../app/core/support/container.js'
import { randomIdGenerator } from '../app/core/support/ids.js'
import { buildConfig, type Env } from '../config/index.js'

/** Composition des dépendances transverses. Les modules ajoutent les leurs via leur provider. */
export function createContainer(env: Env): Container {
  const container = new Container<Registry>()

  container.bindValue('config', buildConfig(env))
  container.bind('logger', (c) => createLogger({ level: c.make('config').logger.level }))
  container.bindValue('clock', systemClock)
  container.bindValue('ids', randomIdGenerator)

  container.bind('prisma', (c) => {
    const prisma = createPrismaClient(c.make('config').database.url)
    c.onDispose(() => prisma.$disconnect())
    return prisma
  })

  container.bind('redis', (c) => {
    const redis = createRedisClient(c.make('config').redis.url)
    const logger = c.make('logger')
    redis.on('error', (error: Error) => {
      logger.warn({ err: error }, 'redis_error')
    })
    c.onDispose(async () => {
      if (redis.status === 'ready') {
        await redis.quit()
      } else {
        redis.disconnect()
      }
    })
    return redis
  })

  return container
}
