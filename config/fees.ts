import { z } from 'zod'

export const feesEnvSchema = z.object({
  /** Barème des frais (JSON). Chemin relatif au dossier de lancement. Voir docs/fees.md. */
  FEES_FILE_PATH: z.string().min(1).default('config/fees.json'),
})

export function feesConfig(env: z.infer<typeof feesEnvSchema>) {
  return { filePath: env.FEES_FILE_PATH } as const
}
