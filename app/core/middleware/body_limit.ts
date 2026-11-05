import { bodyLimit } from 'hono/body-limit'
import { HttpException } from '../exceptions/http_exception.js'

export function bodyLimitMiddleware(maxSize: number) {
  return bodyLimit({
    maxSize,
    onError: () => {
      throw new HttpException({
        status: 413,
        code: 'payload_too_large',
        title: 'Corps de requête trop volumineux',
      })
    },
  })
}
