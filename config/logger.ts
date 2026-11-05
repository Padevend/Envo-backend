import { z } from 'zod'

export const loggerEnvSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export function loggerConfig(env: z.infer<typeof loggerEnvSchema>) {
  return { level: env.LOG_LEVEL } as const
}
