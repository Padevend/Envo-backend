# Rapport CI

- branche : phase-2/ci-fixes
- commit : 11ae81d8a86ac03fc171b64bc6bf1d89001acf5c
- run : https://github.com/Padevend/Envo-backend/actions/runs/42372016288

| étape | résultat |
|---|---|
| installation | success |
| prisma generate | success |
| migrations | success |
| lint | success |
| typecheck | failure |
| arch | success |
| tests | failure |
| audit | success |
| build | success |

## install
```
Progress: resolved 1, reused 0, downloaded 0, added 0
 WARN  deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.
Progress: resolved 20, reused 0, downloaded 18, added 0
Progress: resolved 175, reused 0, downloaded 161, added 0
Progress: resolved 273, reused 0, downloaded 227, added 0
Progress: resolved 367, reused 0, downloaded 299, added 0
 WARN  2 deprecated subdependencies found: cron-parser@4.9.0, glob@10.5.0
Packages: +314
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 369, reused 0, downloaded 314, added 312
Progress: resolved 369, reused 0, downloaded 314, added 313
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

Done in 11.8s
```

## generate
```

> envo-backend@0.0.0 prisma:generate /home/runner/work/Envo-backend/Envo-backend
> prisma generate --schema prisma/schema

Prisma schema loaded from prisma/schema

✔ Generated Prisma Client (v6.19.3) to ./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 57ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Interested in query caching in just a few lines of code? Try Accelerate today! https://pris.ly/tip-3-accelerate

```

## migrate
```

> envo-backend@0.0.0 db:migrate:deploy /home/runner/work/Envo-backend/Envo-backend
> prisma migrate deploy --schema prisma/schema

Prisma schema loaded from prisma/schema
Datasource "db": PostgreSQL database "envo_test", schema "public" at "localhost:5432"

No migration found in prisma/migrations


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
No pending migrations to apply.
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

tests/unit/fee_schedule.test.ts(51,18): error TS18048: 'rule' is possibly 'undefined'.
tests/unit/fee_schedule.test.ts(51,44): error TS18048: 'rule' is possibly 'undefined'.
 ELIFECYCLE  Command failed with exit code 2.
```

## arch
```

> envo-backend@0.0.0 arch /home/runner/work/Envo-backend/Envo-backend
> depcruise app config start bin app.rc.ts --config .dependency-cruiser.cjs


[32m✔[39m no dependency violations found (125 modules, 121 dependencies cruised)

```

## test
```
/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35

  33 })
  34 
  35 beforeEach(async () => {
→ 36   await prisma.listenerDelivery.deleteMany(
The table `public.listener_deliveries` does not exist in the current database.[39m
[90m [2m❯[22m ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:[2m228:13[22m[39m
[90m [2m❯[22m ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:[2m174:12[22m[39m
[90m [2m❯[22m ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:[2m143:12[22m[39m
[90m [2m❯[22m a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:[2m833:24[22m[39m
[36m [2m❯[22m tests/integration/postgres.test.ts:[2m36:5[22m[39m
    [90m 34| [39m
    [90m 35| [39m  [34mbeforeEach[39m([35masync[39m () [33m=>[39m {
    [90m 36| [39m    [35mawait[39m prisma[33m.[39mlistenerDelivery[33m.[39m[34mdeleteMany[39m()
    [90m   | [39m    [31m^[39m
    [90m 37| [39m    [35mawait[39m prisma[33m.[39moutboxEvent[33m.[39m[34mdeleteMany[39m()
    [90m 38| [39m  })

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[15/26]⎯[22m[39m

[41m[1m FAIL [22m[49m tests/unit/fee_schedule.test.ts[2m > [22mvalidation du barème[2m > [22mrefuse les clés inconnues, pays et moyens de paiement mal nommés
[31m[1mAssertionError[22m: expected 'Fichier de frais invalide :\n  - meso…' to contain 'code pays'[39m

[32m- Expected[39m
[31m+ Received[39m

[32m- code pays[39m
[31m+ Fichier de frais invalide :[39m
[31m+   - mesomb.cm : Invalid key in record[39m

[36m [2m❯[22m tests/unit/fee_schedule.test.ts:[2m88:86[22m[39m
    [90m 86| [39m  it('refuse les clés inconnues, pays et moyens de paiement mal nommés…
    [90m 87| [39m    [34mexpect[39m([34missuesOf[39m([34mbase[39m({ inconnu[33m:[39m [35mtrue[39m })))[33m.[39mnot[33m.[39m[34mtoBe[39m([32m''[39m)
    [90m 88| [39m    expect(issuesOf(base({ mesomb: { cm: { MTN_MOMO: { COLLECT: validR…
    [90m   | [39m                                                                                     [31m^[39m
    [90m 89| [39m    expect(issuesOf(base({ mesomb: { CM: { 'mtn momo': { COLLECT: vali…
    [90m 90| [39m  })

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[16/26]⎯[22m[39m


[2m Test Files [22m [1m[31m5 failed[39m[22m[2m | [22m[1m[32m17 passed[39m[22m[90m (22)[39m
[2m      Tests [22m [1m[31m25 failed[39m[22m[2m | [22m[1m[32m146 passed[39m[22m[2m | [22m[33m21 skipped[39m[90m (192)[39m
[2m   Start at [22m 12:21:21
[2m   Duration [22m 2.75s[2m (transform 722ms, setup 0ms, collect 2.57s, tests 1.26s, environment 3ms, prepare 1.33s)[22m


::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/live > répond 200 avec identifiant de corrélation et en-têtes de sécurité,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:20:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/live > reprend un X-Request-Id valide,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:31:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/live > remplace un X-Request-Id invalide,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:39:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/ready > répond 200 quand toutes les sondes sont up,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:49:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/ready > répond 503 sans révéler le détail de l'erreur quand une sonde est down,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:60:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/ready > considère une sonde trop lente comme down,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:72:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > GET /health/version > expose la version,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:82:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > erreurs HTTP (application/problem+json) > renvoie un 404 structuré avec le requestId,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:90:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > erreurs HTTP (application/problem+json) > masque les erreurs inattendues derrière un 500 générique,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:101:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > erreurs HTTP (application/problem+json) > refuse un corps trop volumineux (413),line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:115:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > erreurs HTTP (application/problem+json) > n'autorise aucune origine CORS par défaut,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:128:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/health.test.ts > erreurs HTTP (application/problem+json) > autorise une origine listée,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/health.test.ts:136:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/core/support/container.ts,title=tests/e2e/rate_limit.test.ts > rate limit global (kernel) > bloque au-delà de la limite configurée%2C sauf sur /health,line=51,column=13::Error: Liaison déjà enregistrée : rateLimitBackend%0A ❯ Container.bind app/core/support/container.ts:51:13%0A ❯ Container.bindValue app/core/support/container.ts:57:10%0A ❯ createTestApp tests/helpers/create_test_app.ts:37:13%0A ❯ tests/e2e/rate_limit.test.ts:7:27%0A%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/app/modules/ledger/repositories/account_repository.ts,title=tests/integration/ledger.test.ts > intégration ledger (PostgreSQL),line=75,column=17::PrismaClientKnownRequestError: %0AInvalid `this.prisma.ledgerAccount.findUnique()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/app/modules/ledger/repositories/account_repository.ts:75:49%0A%0A  72 }%0A  73 %0A  74 async findSystemId(code: SystemAccountCode): Promise<string | null> {%0A→ 75   const row = await this.prisma.ledgerAccount.findUnique(%0AThe table `public.ledger_accounts` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ AccountRepository.findSystemId app/modules/ledger/repositories/account_repository.ts:75:17%0A ❯ AccountService.systemAccountId app/modules/ledger/services/account_service.ts:66:16%0A ❯ tests/integration/ledger.test.ts:41:16%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'LedgerAccount', table: 'public.ledger_accounts' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > verrouille%2C refuse un doublon en cours%2C puis rejoue la réponse,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > permet de réessayer après une libération,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > ne libère pas une requête déjà terminée,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > reprend un verrou périmé (processus mort),line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > accorde le verrou à une seule requête parmi dix simultanées,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > PrismaIdempotencyStore > purge les clés expirées,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > UnitOfWork%2C outbox et relais > écrit l'événement avec la transaction %3A validé ensemble%2C annulé ensemble,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > UnitOfWork%2C outbox et relais > livre l'événement à un listener une seule fois%2C de bout en bout,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > UnitOfWork%2C outbox et relais > ne traite pas deux fois un événement pour un même listener,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > UnitOfWork%2C outbox et relais > annule les effets d'un listener en échec et reprogramme l'événement,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts,title=tests/integration/postgres.test.ts > intégration PostgreSQL > UnitOfWork%2C outbox et relais > réserve un événement une seule fois%2C même avec des relais concurrents,line=36,column=5::PrismaClientKnownRequestError: %0AInvalid `prisma.listenerDelivery.deleteMany()` invocation in%0A/home/runner/work/Envo-backend/Envo-backend/tests/integration/postgres.test.ts:36:35%0A%0A  33 })%0A  34 %0A  35 beforeEach(async () => {%0A→ 36   await prisma.listenerDelivery.deleteMany(%0AThe table `public.listener_deliveries` does not exist in the current database.%0A ❯ ei.handleRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13%0A ❯ ei.handleAndLogRequestError node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12%0A ❯ ei.request node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12%0A ❯ a node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_magicast@0.3.5_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24%0A ❯ tests/integration/postgres.test.ts:36:5%0A%0A⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯%0ASerialized Error: { code: 'P2021', meta: { modelName: 'ListenerDelivery', table: 'public.listener_deliveries' }, clientVersion: '6.19.3', batchRequestIdx: undefined }%0A

::error file=/home/runner/work/Envo-backend/Envo-backend/tests/unit/fee_schedule.test.ts,title=tests/unit/fee_schedule.test.ts > validation du barème > refuse les clés inconnues%2C pays et moyens de paiement mal nommés,line=88,column=86::AssertionError: expected 'Fichier de frais invalide :\n  - meso…' to contain 'code pays'%0A%0A- Expected%0A+ Received%0A%0A- code pays%0A+ Fichier de frais invalide :%0A+   - mesomb.cm : Invalid key in record%0A%0A ❯ tests/unit/fee_schedule.test.ts:88:86%0A%0A
 ELIFECYCLE  Test failed. See above for more details.
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
