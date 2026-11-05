export const ERROR_STATUSES = [
  400, 401, 403, 404, 405, 408, 409, 413, 415, 422, 423, 429, 500, 502, 503, 504,
] as const

export type ErrorStatus = (typeof ERROR_STATUSES)[number]

export function isErrorStatus(value: number): value is ErrorStatus {
  return (ERROR_STATUSES as readonly number[]).includes(value)
}

export interface HttpExceptionInit {
  status: ErrorStatus
  code: string
  title: string
  detail?: string
  cause?: unknown
}

/** Erreur HTTP volontaire : son `code` est stable et son `detail` est rédigé pour le client. */
export class HttpException extends Error {
  readonly status: ErrorStatus
  readonly code: string
  readonly title: string
  readonly detail: string | undefined

  constructor(init: HttpExceptionInit) {
    super(init.detail ?? init.title, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'HttpException'
    this.status = init.status
    this.code = init.code
    this.title = init.title
    this.detail = init.detail
  }
}
