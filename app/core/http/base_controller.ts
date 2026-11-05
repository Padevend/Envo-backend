import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppEnv } from './app_env.js'

/** Les contrôleurs sont des adaptateurs HTTP minces : aucune logique métier ici. */
export abstract class BaseController {
  protected json(c: Context<AppEnv>, body: object, status: ContentfulStatusCode = 200): Response {
    return c.newResponse(JSON.stringify(body), status, {
      'Content-Type': 'application/json; charset=UTF-8',
    })
  }
}
