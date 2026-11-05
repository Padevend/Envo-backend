import type { ErrorStatus } from './http_exception.js'

export interface DomainExceptionInit {
  code: string
  title: string
  status?: ErrorStatus
  detail?: string
  cause?: unknown
}

/** Erreur métier : les exceptions de chaque module étendent cette classe (code stable, statut 422 par défaut). */
export class DomainException extends Error {
  readonly code: string
  readonly title: string
  readonly status: ErrorStatus
  readonly detail: string | undefined

  constructor(init: DomainExceptionInit) {
    super(init.detail ?? init.title, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'DomainException'
    this.code = init.code
    this.title = init.title
    this.status = init.status ?? 422
    this.detail = init.detail
  }
}
