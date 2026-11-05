import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.ts', 'start/**/*.ts', 'config/**/*.ts'],
      reporter: ['text', 'lcov'],
      // Seuils (≥ 90 % ledger/auth/payments, ≥ 80 % global) à activer quand ces modules existent.
    },
  },
})
