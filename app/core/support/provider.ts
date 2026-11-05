import type { Hono } from 'hono'
import type { AppEnv } from '../http/app_env.js'
import type { Container } from './container.js'

/** Chaque module expose un provider : `register` (liaisons) puis `boot` (listeners, jobs, …). */
export interface Provider {
  readonly name: string
  register(container: Container): void
  boot?(app: Hono<AppEnv>, container: Container): void | Promise<void>
}
