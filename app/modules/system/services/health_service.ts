import type { Logger } from 'pino'
import type { Clock } from '../../../core/support/clock.js'
import type { HealthProbe, LiveStatus, ProbeResult, Readiness } from '../contracts.js'

export interface HealthServiceDeps {
  probes: readonly HealthProbe[]
  timeoutMs: number
  clock: Clock
  logger: Logger
}

function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('délai dépassé')), timeoutMs)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export class HealthService {
  constructor(private readonly deps: HealthServiceDeps) {}

  /** Liveness : le processus répond. Aucune dépendance externe vérifiée. */
  live(): LiveStatus {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) }
  }

  /** Readiness : toutes les sondes (Postgres, Redis, …) répondent dans le délai imparti. */
  async ready(): Promise<Readiness> {
    const checks = await Promise.all(this.deps.probes.map((probe) => this.run(probe)))
    return {
      status: checks.every((check) => check.status === 'up') ? 'ok' : 'degraded',
      checks,
      checkedAt: this.deps.clock.now(),
    }
  }

  private async run(probe: HealthProbe): Promise<ProbeResult> {
    const startedAt = performance.now()
    try {
      await withTimeout(probe.check(), this.deps.timeoutMs)
      return { name: probe.name, status: 'up', latencyMs: Math.round(performance.now() - startedAt) }
    } catch (error) {
      // Le détail reste dans les logs : la réponse HTTP ne révèle rien de l'infrastructure.
      this.deps.logger.warn({ err: error, probe: probe.name }, 'health_probe_failed')
      return {
        name: probe.name,
        status: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
      }
    }
  }
}
