# Rapport CI

- branche : phase-2/ci-fixes
- commit : 93897e96823d14bdb11a79819e4ae8bea0283012
- run : https://github.com/Padevend/Envo-backend/actions/runs/42393654571

| étape | résultat |
|---|---|
| installation | success |
| prisma generate | success |
| migrations | success |
| lint | success |
| typecheck | success |
| arch | success |
| tests | success |
| audit | success |
| build | success |

## install
```
Progress: resolved 1, reused 0, downloaded 0, added 0
 WARN  deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.
Progress: resolved 19, reused 0, downloaded 17, added 0
Progress: resolved 97, reused 0, downloaded 84, added 0
Progress: resolved 233, reused 0, downloaded 185, added 0
Progress: resolved 287, reused 0, downloaded 239, added 0
 WARN  2 deprecated subdependencies found: cron-parser@4.9.0, glob@10.5.0
Packages: +314
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 369, reused 0, downloaded 313, added 0
Progress: resolved 369, reused 0, downloaded 314, added 314, done
.../node_modules/@prisma/engines postinstall$ node scripts/postinstall.js
.../esbuild@0.28.2/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.28.2/node_modules/esbuild postinstall: Done
.../node_modules/@prisma/engines postinstall: Done
.../node_modules/prisma preinstall$ node scripts/preinstall-entry.js
.../node_modules/prisma preinstall: Done
.../node_modules/@prisma/client postinstall$ node scripts/postinstall.js
.../node_modules/@prisma/client postinstall: prisma:warn We could not find your Prisma schema in the default locations (see: https://pris.ly/d/prisma-schema-location).
.../node_modules/@prisma/client postinstall: If you have a Prisma schema file in a custom path, you will need to run
.../node_modules/@prisma/client postinstall: `prisma generate --schema=./path/to/your/schema.prisma` to generate Prisma Client.
.../node_modules/@prisma/client postinstall: If you do not have a Prisma schema file yet, you can ignore this message.
.../node_modules/@prisma/client postinstall: Done

dependencies:
+ @hono/node-server 1.19.18 (2.1.6 is available)
+ @prisma/client 6.19.3 (7.10.1 is available)
+ bullmq 5.81.5 (6.7.2 is available)
+ hono 4.13.17
+ ioredis 5.11.1 (6.0.0 is available)
+ pino 9.14.0 (10.4.0 is available)
+ zod 4.6.7

devDependencies:
+ @eslint/js 9.39.5 (10.0.1 is available)
+ @types/node 22.20.5 (26.6.6 is available)
+ @vitest/coverage-v8 3.2.7 (5.1.0 is available)
+ dependency-cruiser 16.10.4 (18.7.2 is available)
+ eslint 9.39.5 (10.14.0 is available) deprecated
+ fast-check 4.10.2
+ globals 16.5.0 (17.14.0 is available)
+ prettier 3.9.10
+ prisma 6.19.3 (8.0.0-rc.33 is available)
+ tsx 4.23.15
+ typescript 5.9.3 (7.0.2 is available)
+ typescript-eslint 8.72.1
+ vitest 3.2.7 (5.1.0 is available)

The following dependencies have build scripts that were ignored: msgpackr-extract
To allow the execution of build scripts for these packages, add their names to "pnpm.onlyBuiltDependencies" in your "package.json", then run "pnpm rebuild"

Done in 9.7s
```

## generate
```

> envo-backend@0.0.0 prisma:generate /home/runner/work/Envo-backend/Envo-backend
> prisma generate --schema prisma/schema

Prisma schema loaded from prisma/schema

✔ Generated Prisma Client (v6.19.3) to ./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 118ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Interested in query caching in just a few lines of code? Try Accelerate today! https://pris.ly/tip-3-accelerate

```

## migrate
```

> envo-backend@0.0.0 db:migrate:deploy /home/runner/work/Envo-backend/Envo-backend
> prisma migrate deploy --schema prisma/schema

Prisma schema loaded from prisma/schema
Datasource "db": PostgreSQL database "envo_test", schema "public" at "localhost:5432"

2 migrations found in prisma/migrations

Applying migration `20261105120000_core_foundation`
Applying migration `20261106100000_ledger`

┌─────────────────────────────────────────────────────────┐
│  Update available 6.19.3 -> 8.0.0-rc.33                 │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
The following migration(s) have been applied:

migrations/
  └─ 20261105120000_core_foundation/
    └─ migration.sql
  └─ 20261106100000_ledger/
    └─ migration.sql
      
All migrations have been successfully applied.
```

## lint
```

> envo-backend@0.0.0 lint /home/runner/work/Envo-backend/Envo-backend
> eslint .

```

## typecheck
```

> envo-backend@0.0.0 typecheck /home/runner/work/Envo-backend/Envo-backend
> tsc --noEmit

```

## arch
```

> envo-backend@0.0.0 arch /home/runner/work/Envo-backend/Envo-backend
> depcruise app config start bin app.rc.ts --config .dependency-cruiser.cjs


[32m✔[39m no dependency violations found (125 modules, 121 dependencies cruised)

```

## test
```

> envo-backend@0.0.0 test /home/runner/work/Envo-backend/Envo-backend
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/runner/work/Envo-backend/Envo-backend[39m

 [32m✓[39m tests/unit/idempotency_middleware.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 57[2mms[22m[39m
 [32m✓[39m tests/integration/postgres.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 298[2mms[22m[39m
 [32m✓[39m tests/unit/fee_calculator.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32m✓[39m tests/unit/entry_rules.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 23[2mms[22m[39m
 [32m✓[39m tests/unit/outbox_relay.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32m✓[39m tests/unit/crypto.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32m✓[39m tests/e2e/health.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 218[2mms[22m[39m
 [32m✓[39m tests/unit/fee_schedule.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m tests/unit/rate_limit_middleware.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 35[2mms[22m[39m
 [32m✓[39m tests/unit/env.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32m✓[39m tests/architecture.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m tests/integration/ledger.test.ts [2m([22m[2m21 tests[22m[2m)[22m[33m 1805[2mms[22m[39m
   [33m[2m✓[22m[39m intégration ledger (PostgreSQL)[2m > [22minvariants et propriétés[2m > [22mpropriétés : modèle exact, conservation du total, aucun solde négatif [33m 1065[2mms[22m[39m
 [32m✓[39m tests/unit/money.test.ts [2m([22m[2m24 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m tests/unit/unit_of_work.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m tests/unit/money_property.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32m✓[39m tests/unit/retry.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m tests/unit/container.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m tests/unit/problem.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m tests/integration/redis.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 660[2mms[22m[39m
   [33m[2m✓[22m[39m intégration Redis[2m > [22mRedisRateLimitBackend (script Lua)[2m > [22mrefuse au-delà de la limite, puis libère une place quand la fenêtre glisse [33m 517[2mms[22m[39m
 [32m✓[39m tests/unit/logger.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m tests/unit/queue_connection.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m tests/e2e/rate_limit.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 41[2mms[22m[39m

[2m Test Files [22m [1m[32m22 passed[39m[22m[90m (22)[39m
[2m      Tests [22m [1m[32m192 passed[39m[22m[90m (192)[39m
[2m   Start at [22m 16:55:34
[2m   Duration [22m 3.51s[2m (transform 723ms, setup 0ms, collect 2.48s, tests 3.32s, environment 4ms, prepare 1.32s)[22m

```

## audit
```

> envo-backend@0.0.0 audit:deps /home/runner/work/Envo-backend/Envo-backend
> pnpm audit --audit-level=high

7 vulnerabilities found
Severity: 7 moderate
```

## build
```

> envo-backend@0.0.0 build /home/runner/work/Envo-backend/Envo-backend
> tsc -p tsconfig.build.json

```
