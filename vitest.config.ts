import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Les tests d'intégration (Postgres, Redis, BullMQ) peuvent être plus lents.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['app/**/*.ts', 'start/**/*.ts', 'config/**/*.ts'],
      reporter: ['text', 'lcov'],
      // Seuils (≥ 90 % ledger/auth/payments, ≥ 80 % global) à activer quand ces modules existent.
    },
  },
})
