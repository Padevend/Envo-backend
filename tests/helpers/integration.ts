export const INTEGRATION = process.env['RUN_INTEGRATION'] === '1'

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Variable ${name} requise pour les tests d'intégration`)
  }
  return value
}

export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Condition non remplie après ${timeoutMs} ms`)
}
