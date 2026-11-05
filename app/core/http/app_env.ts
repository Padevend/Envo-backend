import type { Logger } from 'pino'

/** Type d'environnement Hono unique de l'application. */
export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
  }
}
