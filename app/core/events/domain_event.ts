import type { Prisma } from '@prisma/client'

/**
 * Table des événements de domaine : type → charge utile.
 * Chaque module l'étend par fusion d'interface dans son contracts.ts, par exemple :
 *   declare module '../../core/events/domain_event.js' {
 *     interface DomainEventMap { 'funds.received': { walletId: string; amount: string } }
 *   }
 * Les charges utiles sont du JSON pur (montants en chaîne, dates ISO).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- cible d'augmentation par les modules
export interface DomainEventMap {}

export type DomainEventType = keyof DomainEventMap & string

export interface DomainEvent<K extends DomainEventType = DomainEventType> {
  id: string
  type: K
  aggregateId: string | null
  occurredAt: Date
  payload: DomainEventMap[K]
}

export type EventPayload = Prisma.InputJsonObject
