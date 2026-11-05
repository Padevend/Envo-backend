import { HTTPException } from 'hono/http-exception'
import { DomainException } from './domain_exception.js'
import { HttpException, isErrorStatus, type ErrorStatus } from './http_exception.js'

/** Corps d'erreur `application/problem+json` (RFC 9457). Jamais de trace ni de détail interne. */
export interface Problem {
  type: string
  title: string
  status: ErrorStatus
  code: string
  requestId: string
  detail?: string
}

const STATUS_PROBLEMS: Record<ErrorStatus, { code: string; title: string }> = {
  400: { code: 'bad_request', title: 'Requête invalide' },
  401: { code: 'unauthorized', title: 'Authentification requise' },
  403: { code: 'forbidden', title: 'Accès refusé' },
  404: { code: 'not_found', title: 'Ressource introuvable' },
  405: { code: 'method_not_allowed', title: 'Méthode non autorisée' },
  408: { code: 'request_timeout', title: 'Délai de requête dépassé' },
  409: { code: 'conflict', title: 'Conflit' },
  413: { code: 'payload_too_large', title: 'Corps de requête trop volumineux' },
  415: { code: 'unsupported_media_type', title: 'Type de contenu non supporté' },
  422: { code: 'unprocessable_entity', title: 'Requête non traitable' },
  423: { code: 'locked', title: 'Ressource verrouillée' },
  429: { code: 'too_many_requests', title: 'Trop de requêtes' },
  500: { code: 'internal_error', title: 'Erreur interne' },
  502: { code: 'bad_gateway', title: 'Passerelle invalide' },
  503: { code: 'service_unavailable', title: 'Service indisponible' },
  504: { code: 'gateway_timeout', title: 'Délai de traitement dépassé' },
}

function buildProblem(
  status: ErrorStatus,
  code: string,
  title: string,
  requestId: string,
  detail: string | undefined,
): Problem {
  const problem: Problem = { type: `urn:envo:problem:${code}`, title, status, code, requestId }
  if (detail !== undefined) {
    problem.detail = detail
  }
  return problem
}

export function problemFor(status: ErrorStatus, requestId: string): Problem {
  const { code, title } = STATUS_PROBLEMS[status]
  return buildProblem(status, code, title, requestId, undefined)
}

/** Convertit n'importe quelle erreur en problem. Les erreurs inconnues deviennent un 500 générique. */
export function toProblem(error: unknown, requestId: string): Problem {
  if (error instanceof HttpException || error instanceof DomainException) {
    return buildProblem(error.status, error.code, error.title, requestId, error.detail)
  }
  if (error instanceof HTTPException) {
    return problemFor(isErrorStatus(error.status) ? error.status : 500, requestId)
  }
  return problemFor(500, requestId)
}
