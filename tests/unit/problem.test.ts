import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { DomainException } from '../../app/core/exceptions/domain_exception.js'
import { toProblem } from '../../app/core/exceptions/handler.js'
import { HttpException } from '../../app/core/exceptions/http_exception.js'

describe('toProblem', () => {
  it('convertit une HttpException en conservant code, titre et détail', () => {
    const error = new HttpException({
      status: 409,
      code: 'conflict_example',
      title: 'Conflit',
      detail: 'Détail rédigé pour le client',
    })
    expect(toProblem(error, 'req-1')).toEqual({
      type: 'urn:envo:problem:conflict_example',
      title: 'Conflit',
      status: 409,
      code: 'conflict_example',
      requestId: 'req-1',
      detail: 'Détail rédigé pour le client',
    })
  })

  it('utilise 422 par défaut pour une DomainException', () => {
    const problem = toProblem(new DomainException({ code: 'insufficient_funds', title: 'Solde insuffisant' }), 'req-2')
    expect(problem.status).toBe(422)
    expect(problem.code).toBe('insufficient_funds')
    expect('detail' in problem).toBe(false)
  })

  it('traduit une HTTPException de Hono sans reprendre son message', () => {
    const problem = toProblem(new HTTPException(504, { message: 'message interne' }), 'req-3')
    expect(problem.status).toBe(504)
    expect(problem.code).toBe('gateway_timeout')
    expect(JSON.stringify(problem)).not.toContain('message interne')
  })

  it('transforme toute erreur inconnue en 500 générique', () => {
    const problem = toProblem(new Error('db password=hunter2'), 'req-4')
    expect(problem.status).toBe(500)
    expect(problem.code).toBe('internal_error')
    expect(JSON.stringify(problem)).not.toContain('hunter2')
  })
})
