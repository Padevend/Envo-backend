import { z } from 'zod'

export const redisEnvSchema = z.object({
  REDIS_URL: z
    .string()
    .min(1)
    .refine((value) => /^rediss?:\/\//.test(value), 'doit commencer par redis:// ou rediss://'),
})

export function redisConfig(env: z.infer<typeof redisEnvSchema>) {
  return { url: env.REDIS_URL } as const
}
