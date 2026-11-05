export interface BackoffOptions {
  baseDelayMs: number
  maxDelayMs: number
  factor?: number
}

/** Délai exponentiel avec "full jitter" : aléatoire dans [0, min(max, base * factor^(tentative-1))]. */
export function backoffDelayMs(
  attempt: number,
  options: BackoffOptions,
  random: () => number = Math.random,
): number {
  const factor = options.factor ?? 2
  const ceiling = Math.min(options.maxDelayMs, options.baseDelayMs * factor ** (attempt - 1))
  return Math.floor(random() * ceiling)
}

export interface RetryOptions {
  maxAttempts: number
  shouldRetry: (error: unknown) => boolean
  backoff: BackoffOptions
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** Exécute `operation` jusqu'à `maxAttempts` fois tant que `shouldRetry` accepte l'erreur. */
export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt)
    } catch (error) {
      if (attempt >= options.maxAttempts || !options.shouldRetry(error)) {
        throw error
      }
      await sleep(backoffDelayMs(attempt, options.backoff, options.random))
    }
  }
}
