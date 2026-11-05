import type { z } from 'zod'
import { appConfig, appEnvSchema } from './app.js'
import { corsConfig, corsEnvSchema } from './cors.js'
import { databaseConfig, databaseEnvSchema } from './database.js'
import { limitsConfig, limitsEnvSchema } from './limits.js'
import { loggerConfig, loggerEnvSchema } from './logger.js'
import { redisConfig, redisEnvSchema } from './redis.js'

/** Schéma complet des variables d'environnement : une variable manquante = refus de démarrer. */
export const envSchema = appEnvSchema
  .extend(databaseEnvSchema.shape)
  .extend(redisEnvSchema.shape)
  .extend(loggerEnvSchema.shape)
  .extend(corsEnvSchema.shape)
  .extend(limitsEnvSchema.shape)

export type Env = z.infer<typeof envSchema>

export function buildConfig(env: Env) {
  return {
    app: appConfig(env),
    database: databaseConfig(env),
    redis: redisConfig(env),
    logger: loggerConfig(env),
    cors: corsConfig(env),
    limits: limitsConfig(env),
  } as const
}

export type Config = ReturnType<typeof buildConfig>
