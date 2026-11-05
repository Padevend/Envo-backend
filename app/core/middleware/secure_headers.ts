import { secureHeaders } from 'hono/secure-headers'

export function secureHeadersMiddleware() {
  return secureHeaders({
    strictTransportSecurity: 'max-age=63072000; includeSubDomains',
    xFrameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  })
}
