import { Prisma, type PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'
import { retry, type BackoffOptions } from '../support/retry.js'

/** Client transactionnel Prisma : à passer aux repositories (`tx` optionnel). */
export type Tx = Prisma.TransactionClient

export type IsolationLevel = 'Serializable' | 'ReadCommitted'

export interface UnitOfWorkOptions {
  isolation?: IsolationLevel
  maxAttempts?: number
}

/** Ce que les services métier, le bus d'événements et le relais consomment (remplaçable en test). */
export interface Transactional {
  run<T>(operation: (tx: Tx) => Promise<T>, options?: UnitOfWorkOptions): Promise<T>
}

export interface TransactionRunner {
  run<T>(
    operation: (tx: Tx) => Promise<T>,
    options: { isolation: IsolationLevel; timeoutMs: number; maxWaitMs: number },
  ): Promise<T>
}

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(
    operation: (tx: Tx) => Promise<T>,
    options: { isolation: IsolationLevel; timeoutMs: number; maxWaitMs: number },
  ): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel:
        options.isolation === 'Serializable'
          ? Prisma.TransactionIsolationLevel.Serializable
          : Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: options.timeoutMs,
      maxWait: options.maxWaitMs,
    })
  }
}

/** Conflit d'écriture, échec de sérialisation ou interblocage : la transaction peut être rejouée. */
export function isSerializationFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const { code, meta } = error as { code?: unknown; meta?: { code?: unknown } }
  if (code === 'P2034') {
    return true
  }
  if (meta?.code === '40001' || meta?.code === '40P01') {
    return true
  }
  const message = error instanceof Error ? error.message : ''
  return message.includes('could not serialize access') || message.includes('deadlock detected')
}

export interface UnitOfWorkSettings {
  defaultIsolation: IsolationLevel
  maxAttempts: number
  timeoutMs: number
  maxWaitMs: number
  backoff: BackoffOptions
}

export const DEFAULT_UNIT_OF_WORK_SETTINGS: UnitOfWorkSettings = {
  defaultIsolation: 'Serializable',
  maxAttempts: 5,
  timeoutMs: 10_000,
  maxWaitMs: 5_000,
  backoff: { baseDelayMs: 20, maxDelayMs: 500 },
}

export interface UnitOfWorkDeps {
  logger: Logger
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

/**
 * Toute opération financière passe ici : une transaction (sérialisable par défaut) avec nouvelle
 * tentative bornée en cas de conflit de sérialisation. `operation` peut donc être exécutée plusieurs
 * fois : elle ne doit avoir aucun effet de bord hors de `tx` (pas d'appel externe, pas d'e-mail).
 */
export class UnitOfWork implements Transactional {
  constructor(
    private readonly runner: TransactionRunner,
    private readonly settings: UnitOfWorkSettings,
    private readonly deps: UnitOfWorkDeps,
  ) {}

  run<T>(operation: (tx: Tx) => Promise<T>, options: UnitOfWorkOptions = {}): Promise<T> {
    const isolation = options.isolation ?? this.settings.defaultIsolation
    return retry(
      (attempt) => {
        if (attempt > 1) {
          this.deps.logger.warn({ attempt, isolation }, 'transaction_retry')
        }
        return this.runner.run(operation, {
          isolation,
          timeoutMs: this.settings.timeoutMs,
          maxWaitMs: this.settings.maxWaitMs,
        })
      },
      {
        maxAttempts: options.maxAttempts ?? this.settings.maxAttempts,
        shouldRetry: isSerializationFailure,
        backoff: this.settings.backoff,
        ...(this.deps.sleep === undefined ? {} : { sleep: this.deps.sleep }),
        ...(this.deps.random === undefined ? {} : { random: this.deps.random }),
      },
    )
  }
}
