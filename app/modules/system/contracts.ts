// Contrats publics du module `system` (health checks, version, interrupteurs d'urgence).

export interface HealthProbe {
  readonly name: string
  check(): Promise<void>
}

export interface ProbeResult {
  name: string
  status: 'up' | 'down'
  latencyMs: number
}

export interface Readiness {
  status: 'ok' | 'degraded'
  checks: ProbeResult[]
  checkedAt: Date
}

export interface LiveStatus {
  status: 'ok'
  uptimeSeconds: number
}

export interface VersionInfo {
  version: string
  commit: string | null
}

declare module '../../core/support/container.js' {
  interface Registry {
    healthProbes: readonly HealthProbe[]
  }
}
