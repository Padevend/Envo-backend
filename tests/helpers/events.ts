// Augmentation de la table des événements, réservée aux tests.
declare module '../../app/core/events/domain_event.js' {
  interface DomainEventMap {
    'test.happened': { value: string }
  }
}

export const TEST_EVENT = 'test.happened' as const
