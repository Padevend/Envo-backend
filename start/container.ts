import { createPrismaClient } from '../app/core/database/prisma_client.js'
import { createRedisClient } from '../app/core/database/redis_client.js'
import { AesGcmCipher } from '../app/core/crypto/aes_gcm.js'
import { BlindIndexer } from '../app/core/crypto/hmac.js'
import {
  DEFAULT_UNIT_OF_WORK_SETTINGS,
  PrismaTransactionRunner,
  UnitOfWork,
} from '../app/core/database/unit_of_work.js'
import { EventBus } from '../app/core/events/event_bus.js'
import { OutboxPublisher } from '../app/core/events/outbox_publisher.js'
import { OutboxRelay } from '../app/core/events/outbox_relay.js'
import { PrismaDeliveryRepository } from '../app/core/events/prisma_delivery_repository.js'
import { PrismaOutboxRepository } from '../app/core/events/prisma_outbox_repository.js'
import { PrismaIdempotencyStore } from '../app/core/idempotency/prisma_idempotency_store.js'
import { createLogger } from '../app/core/logger/logger.js'
import { RedisRateLimitBackend } from '../app/core/rate_limit/redis_rate_limit_backend.js'
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

  // Crypto : clés lues dans la config validée au démarrage.
  container.bind('cipher', (c) => {
    const { activeKeyVersion, encryptionKeys } = c.make('config').security
    return new AesGcmCipher({ activeVersion: activeKeyVersion, keys: encryptionKeys })
  })
  container.bind('blindIndexer', (c) => new BlindIndexer(c.make('config').security.blindIndexKey))

  // Transactions, événements, idempotence, limitation de débit.
  container.bind(
    'unitOfWork',
    (c) =>
      new UnitOfWork(new PrismaTransactionRunner(c.make('prisma')), DEFAULT_UNIT_OF_WORK_SETTINGS, {
        logger: c.make('logger'),
      }),
  )
  container.bind('eventBus', () => new EventBus())
  container.bind('outbox', (c) => new PrismaOutboxRepository(c.make('prisma')))
  container.bind('deliveries', () => new PrismaDeliveryRepository())
  container.bind(
    'outboxPublisher',
    (c) => new OutboxPublisher(c.make('outbox'), c.make('ids'), c.make('clock')),
  )
  container.bind('outboxRelay', (c) => {
    const queue = c.make('config').queue
    return new OutboxRelay({
      outbox: c.make('outbox'),
      bus: c.make('eventBus'),
      uow: c.make('unitOfWork'),
      deliveries: c.make('deliveries'),
      clock: c.make('clock'),
      logger: c.make('logger'),
      settings: {
        batchSize: queue.outboxBatchSize,
        leaseMs: queue.outboxLeaseMs,
        maxAttempts: queue.outboxMaxAttempts,
        backoff: { baseDelayMs: 1_000, maxDelayMs: 300_000 },
      },
    })
  })
  container.bind('idempotencyStore', (c) => new PrismaIdempotencyStore(c.make('prisma')))
  container.bind('rateLimitBackend', (c) => new RedisRateLimitBackend(c.make('redis')))

  return container
}
