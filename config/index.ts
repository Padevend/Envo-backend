import type { z } from 'zod'
import { appConfig, appEnvSchema } from './app.js'
import { corsConfig, corsEnvSchema } from './cors.js'
import { databaseConfig, databaseEnvSchema } from './database.js'
import { limitsConfig, limitsEnvSchema } from './limits.js'
import { loggerConfig, loggerEnvSchema } from './logger.js'
import { queueConfig, queueEnvSchema } from './queue.js'
import { redisConfig, redisEnvSchema } from './redis.js'
import { securityConfig, securityEnvSchema } from './security.js'

/** Schéma complet des variables d'environnement : une variable manquante = refus de démarrer. */
export const envSchema = appEnvSchema
  .extend(databaseEnvSchema.shape)
  .extend(redisEnvSchema.shape)
  .extend(loggerEnvSchema.shape)
  .extend(corsEnvSchema.shape)
  .extend(limitsEnvSchema.shape)
  .extend(securityEnvSchema.shape)
  .extend(queueEnvSchema.shape)
  .superRefine((env, ctx) => {
    if (!env.ENCRYPTION_KEYS.has(env.ENCRYPTION_ACTIVE_KEY_VERSION)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_ACTIVE_KEY_VERSION'],
        message: 'doit correspondre à une version présente dans ENCRYPTION_KEYS',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

export function buildConfig(env: Env) {
  return {
    app: appConfig(env),
    database: databaseConfig(env),
    redis: redisConfig(env),
    logger: loggerConfig(env),
    cors: corsConfig(env),
    limits: limitsConfig(env),
    security: securityConfig(env),
    queue: queueConfig(env),
  } as const
}

export type Config = ReturnType<typeof buildConfig>
