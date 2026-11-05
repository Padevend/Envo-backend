import { z } from 'zod'

export const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => /^postgres(ql)?:\/\//.test(value), 'doit commencer par postgresql://'),
})

export function databaseConfig(env: z.infer<typeof databaseEnvSchema>) {
  return { url: env.DATABASE_URL } as const
}
