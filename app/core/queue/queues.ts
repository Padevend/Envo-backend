import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq'
import type { Logger } from 'pino'
import { backoffDelayMs, type BackoffOptions } from '../support/retry.js'

export const QUEUES = {
  outbox: 'outbox',
  maintenance: 'maintenance',
  deadLetter: 'dead-letter',
} as const

export interface QueueDeps {
  connection: ConnectionOptions
  prefix: string
}

export interface WorkerDeps extends QueueDeps {
  logger: Logger
  deadLetter: Queue
  concurrency?: number
}

export const JOB_ATTEMPTS = 5
export const JOB_BACKOFF: BackoffOptions = { baseDelayMs: 1_000, maxDelayMs: 60_000 }
const MAX_REASON_LENGTH = 500

export function createQueue(name: string, deps: QueueDeps): Queue {
  return new Queue(name, {
    connection: deps.connection,
    prefix: deps.prefix,
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { type: 'custom' },
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3_600 },
    },
  })
}

/**
 * Worker avec backoff exponentiel + jitter et file de lettres mortes : un job qui épuise ses
 * tentatives laisse une trace (métadonnées seulement, jamais ses données) dans `dead-letter`.
 * Les handlers doivent être strictement idempotents (un job peut être joué plusieurs fois).
 */
export function createWorker<Data>(
  name: string,
  handler: (job: Job<Data>) => Promise<void>,
  deps: WorkerDeps,
): Worker<Data> {
  const worker = new Worker<Data>(name, handler, {
    connection: deps.connection,
    prefix: deps.prefix,
    concurrency: deps.concurrency ?? 1,
    settings: {
      backoffStrategy: (attemptsMade: number) =>
        Math.max(1, backoffDelayMs(attemptsMade, JOB_BACKOFF)),
    },
  })

  worker.on('failed', (job, error) => {
    if (job === undefined) {
      return
    }
    deps.logger.warn(
      { queue: name, jobName: job.name, attemptsMade: job.attemptsMade },
      'job_failed',
    )
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      deps.deadLetter
        .add(
          'dead',
          {
            queue: name,
            jobName: job.name,
            jobId: job.id ?? null,
            failedReason: error.message.slice(0, MAX_REASON_LENGTH),
            failedAt: new Date().toISOString(),
          },
          { attempts: 1 },
        )
        .catch((deadLetterError: unknown) => {
          deps.logger.error({ err: deadLetterError, queue: name }, 'dead_letter_failed')
        })
    }
  })
  worker.on('error', (error) => {
    deps.logger.error({ err: error, queue: name }, 'worker_error')
  })
  return worker
}
