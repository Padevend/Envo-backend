import { z } from 'zod'

export const corsEnvSchema = z.object({
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
})

export function corsConfig(env: z.infer<typeof corsEnvSchema>) {
  return { allowedOrigins: env.CORS_ALLOWED_ORIGINS } as const
}
