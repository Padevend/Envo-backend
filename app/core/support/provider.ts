import type { Hono } from 'hono'
import type { AppEnv } from '../http/app_env.js'
import type { Container } from './container.js'

/** Chaque module expose un provider : `register` (liaisons), `subscribe` (listeners d'événements), `boot` (API). */
export interface Provider {
  readonly name: string
  register(container: Container): void
  /** Abonne les listeners du module au bus d'événements (appelé par le worker, qui rejoue l'outbox). */
  subscribe?(container: Container): void
  boot?(app: Hono<AppEnv>, container: Container): void | Promise<void>
}
