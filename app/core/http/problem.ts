import type { Context } from 'hono'
import type { Problem } from '../exceptions/handler.js'
import type { AppEnv } from './app_env.js'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=UTF-8'

export function problemResponse(c: Context<AppEnv>, problem: Problem): Response {
  return c.newResponse(JSON.stringify(problem), problem.status, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
  })
}
