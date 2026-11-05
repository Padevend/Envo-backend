import type { ErrorHandler, NotFoundHandler } from 'hono'
import { problemFor, toProblem } from '../exceptions/handler.js'
import type { AppEnv } from '../http/app_env.js'
import { problemResponse } from '../http/problem.js'

export function createErrorHandler(): ErrorHandler<AppEnv> {
  return (error, c) => {
    const problem = toProblem(error, c.get('requestId') ?? 'unknown')
    const logger = c.get('logger')
    if (problem.status >= 500) {
      logger?.error({ err: error, code: problem.code }, 'request_failed')
    } else {
      logger?.warn({ code: problem.code, status: problem.status }, 'request_rejected')
    }
    return problemResponse(c, problem)
  }
}

export function createNotFoundHandler(): NotFoundHandler<AppEnv> {
  return (c) => problemResponse(c, problemFor(404, c.get('requestId') ?? 'unknown'))
}
