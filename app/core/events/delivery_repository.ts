import type { Tx } from '../database/unit_of_work.js'

/** Enregistre qu'un listener a traité un événement (dans la transaction de ce listener). */
export interface DeliveryRepository {
  /** Vrai si c'est la première livraison, faux si ce listener a déjà traité l'événement. */
  tryRecord(tx: Tx, eventId: string, listener: string): Promise<boolean>
}
