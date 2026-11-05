import { z } from 'zod'

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_HOST: z.string().min(1).default('0.0.0.0'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_VERSION: z.string().min(1).default('0.0.0'),
  APP_COMMIT: z.string().min(1).optional(),
})

export function appConfig(env: z.infer<typeof appEnvSchema>) {
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    host: env.APP_HOST,
    port: env.APP_PORT,
    version: env.APP_VERSION,
    commit: env.APP_COMMIT ?? null,
  } as const
}
