import type { Context } from 'hono'
import type { AppEnv } from '../../../core/http/app_env.js'
import { BaseController } from '../../../core/http/base_controller.js'
import type { VersionInfo } from '../contracts.js'
import type { HealthService } from '../services/health_service.js'
import {
  transformLive,
  transformReadiness,
  transformVersion,
} from '../transformers/health_transformer.js'

export class HealthController extends BaseController {
  constructor(
    private readonly health: HealthService,
    private readonly versionInfo: VersionInfo,
  ) {
    super()
  }

  live = (c: Context<AppEnv>): Response => this.json(c, transformLive(this.health.live()))

  ready = async (c: Context<AppEnv>): Promise<Response> => {
    const readiness = await this.health.ready()
    return this.json(c, transformReadiness(readiness), readiness.status === 'ok' ? 200 : 503)
  }

  version = (c: Context<AppEnv>): Response => this.json(c, transformVersion(this.versionInfo))
}
