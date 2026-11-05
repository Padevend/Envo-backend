import type { LiveStatus, Readiness, VersionInfo } from '../contracts.js'

// La "vue" : jamais d'objet interne renvoyé tel quel au client.

export function transformLive(live: LiveStatus) {
  return { status: live.status, uptimeSeconds: live.uptimeSeconds }
}

export function transformReadiness(readiness: Readiness) {
  return {
    status: readiness.status,
    checkedAt: readiness.checkedAt.toISOString(),
    checks: readiness.checks.map((check) => ({
      name: check.name,
      status: check.status,
      latencyMs: check.latencyMs,
    })),
  }
}

export function transformVersion(info: VersionInfo) {
  return { version: info.version, commit: info.commit }
}
