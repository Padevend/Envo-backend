import type { PrismaClient } from '@prisma/client'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import type { Config } from '../../../config/index.js'
import type { Clock } from './clock.js'
import type { IdGenerator } from './ids.js'

/**
 * Table des liaisons du conteneur (token → type).
 * Les modules l'étendent par fusion d'interface (`declare module`) dans leur contracts.ts.
 */
export interface Registry {
  config: Config
  logger: Logger
  clock: Clock
  ids: IdGenerator
  prisma: PrismaClient
  redis: Redis
}

type Factory<T extends object> = (container: Container<T>) => unknown

/** Conteneur de dépendances typé : sans réflexion ni décorateurs. Chaque liaison est un singleton paresseux. */
export class Container<T extends object = Registry> {
  readonly #factories = new Map<keyof T, Factory<T>>()
  readonly #instances = new Map<keyof T, unknown>()
  readonly #disposers: Array<() => Promise<void> | void> = []

  bind<K extends keyof T>(key: K, factory: (container: Container<T>) => T[K]): void {
    if (this.#factories.has(key)) {
      throw new Error(`Liaison déjà enregistrée : ${String(key)}`)
    }
    this.#factories.set(key, factory)
  }

  bindValue<K extends keyof T>(key: K, value: T[K]): void {
    this.bind(key, () => value)
  }

  has(key: keyof T): boolean {
    return this.#factories.has(key)
  }

  make<K extends keyof T>(key: K): T[K] {
    if (this.#instances.has(key)) {
      return this.#instances.get(key) as T[K]
    }
    const factory = this.#factories.get(key)
    if (factory === undefined) {
      throw new Error(`Liaison introuvable : ${String(key)}`)
    }
    const instance = factory(this)
    this.#instances.set(key, instance)
    return instance as T[K]
  }

  /** Enregistre une action de fermeture (exécutée en ordre inverse à l'arrêt). */
  onDispose(disposer: () => Promise<void> | void): void {
    this.#disposers.push(disposer)
  }

  async shutdown(): Promise<void> {
    const errors: unknown[] = []
    for (const disposer of [...this.#disposers].reverse()) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    this.#disposers.length = 0
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Échec de fermeture d\'une ou plusieurs ressources')
    }
  }
}
