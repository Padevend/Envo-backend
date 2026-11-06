import { redisConnectionOptions } from '../app/core/queue/connection.js'
import { createQueue, createWorker, QUEUES } from '../app/core/queue/queues.js'
import { createContainer } from '../start/container.js'
import { EnvValidationError, loadEnv } from '../start/env.js'
import { loadProviders } from '../start/providers.js'
import { registerSchedules } from '../start/scheduler.js'

/** Processus séparé de l'API : relais de l'outbox, tâches de maintenance, planification. */
async function main(): Promise<void> {
  const env = loadEnv()
  const container = createContainer(env)
  const logger = container.make('logger')
  const config = container.make('config')

  const providers = await loadProviders(container)
  for (const provider of providers) {
    provider.subscribe?.(container)
  }

  const queueDeps = { connection: redisConnectionOptions(config.redis.url), prefix: config.queue.prefix }
  const outboxQueue = createQueue(QUEUES.outbox, queueDeps)
  const maintenanceQueue = createQueue(QUEUES.maintenance, queueDeps)
  const deadLetterQueue = createQueue(QUEUES.deadLetter, queueDeps)
  await registerSchedules({ outbox: outboxQueue, maintenance: maintenanceQueue }, config)

  const relay = container.make('outboxRelay')
  const idempotencyStore = container.make('idempotencyStore')
  const clock = container.make('clock')
  const workerDeps = { ...queueDeps, logger, deadLetter: deadLetterQueue }

  const outboxWorker = createWorker<unknown>(
    QUEUES.outbox,
    async () => {
      // Vide l'outbox par lots, avec une borne pour rendre régulièrement la main.
      for (let batch = 0; batch < 20; batch++) {
        const result = await relay.runOnce()
        if (result.claimed < config.queue.outboxBatchSize) {
          break
        }
      }
    },
    workerDeps,
  )
  const maintenanceWorker = createWorker<unknown>(
    QUEUES.maintenance,
    async (job) => {
      if (job.name === 'purge-idempotency') {
        const deleted = await idempotencyStore.purgeExpired(clock.now())
        logger.info({ deleted }, 'idempotency_purged')
      }
    },
    workerDeps,
  )

  logger.info({ version: config.app.version }, 'worker_started')

  let shuttingDown = false
  const shutdown = (reason: string, exitCode: number): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    logger.info({ reason }, 'shutdown_started')

    const forceTimer = setTimeout(() => {
      logger.error('shutdown_forced')
      process.exit(1)
    }, config.limits.shutdownGraceMs)
    forceTimer.unref()

    // Les workers finissent leurs jobs en cours avant de se fermer.
    Promise.all([outboxWorker.close(), maintenanceWorker.close()])
      .then(() =>
        Promise.all([outboxQueue.close(), maintenanceQueue.close(), deadLetterQueue.close()]),
      )
      .then(() => container.shutdown())
      .then(
        () => process.exit(exitCode),
        (error: unknown) => {
          logger.error({ err: error }, 'shutdown_failed')
          process.exit(1)
        },
      )
  }

  process.on('SIGTERM', () => shutdown('SIGTERM', 0))
  process.on('SIGINT', () => shutdown('SIGINT', 0))
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled_rejection')
    shutdown('unhandledRejection', 1)
  })
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(error.message)
  } else {
    console.error('Échec du démarrage du worker', error)
  }
  process.exit(1)
})
