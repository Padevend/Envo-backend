import type { Provider } from './app/core/support/provider.js'

export type ProviderLoader = () => Promise<{ default: Provider }>

/** Registre des modules : l'ordre est l'ordre de chargement des providers. */
export const providers: readonly ProviderLoader[] = [
  () => import('./app/modules/system/provider.js'),
  () => import('./app/modules/audit/provider.js'),
  () => import('./app/modules/ledger/provider.js'),
  () => import('./app/modules/risk/provider.js'),
  () => import('./app/modules/notifications/provider.js'),
  () => import('./app/modules/payments/provider.js'),
  () => import('./app/modules/wallets/provider.js'),
  () => import('./app/modules/rules/provider.js'),
  () => import('./app/modules/users/provider.js'),
  () => import('./app/modules/auth/provider.js'),
  () => import('./app/modules/reconciliation/provider.js'),
  () => import('./app/modules/admin/provider.js'),
]
