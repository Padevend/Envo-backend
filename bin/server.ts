import { serve } from '@hono/node-server'
import { createApp } from '../start/app.js'
import { createContainer } from '../start/container.js'
import { EnvValidationError, loadEnv } from '../start/env.js'

async function main(): Promise<void> {
  const env = loadEnv()
  const container = createContainer(env)
  const logger = container.make('logger')
  const config = container.make('config')
  const app = await createApp(container)

  const server = serve(
    { fetch: app.fetch, hostname: config.app.host, port: config.app.port },
    (info) => {
      logger.info({ port: info.port, version: config.app.version }, 'server_listening')
    },
  )

  // Arrêt propre : ne plus accepter, finir les requêtes en cours, fermer Prisma et Redis.
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

    server.close((closeError) => {
      container.shutdown().then(
        () => process.exit(closeError === undefined ? exitCode : 1),
        (error: unknown) => {
          logger.error({ err: error }, 'shutdown_failed')
          process.exit(1)
        },
      )
    })
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
    console.error('Échec du démarrage', error)
  }
  process.exit(1)
})
