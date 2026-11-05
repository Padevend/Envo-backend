import type { Env } from '../config/index.js'
import { envSchema } from '../config/index.js'

export class EnvValidationError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Configuration invalide :\n${issues.map((issue) => `  - ${issue}`).join('\n')}`)
    this.name = 'EnvValidationError'
    this.issues = issues
  }
}

/**
 * Valide les variables d'environnement. Une variable manquante ou invalide = refus de démarrer.
 * Seuls les noms et les raisons sont rapportés, jamais les valeurs (elles peuvent être secrètes).
 */
export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.map(String).join('.') || '(racine)'} : ${issue.message}`,
      ),
    )
  }
  return parsed.data
}
