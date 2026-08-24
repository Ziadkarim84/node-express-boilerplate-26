# node-express-boilerplate

Production-ready Node.js + Express 5 + TypeScript boilerplate.

## Stack

| Concern     | Choice                                    | Why                                                                     |
| ----------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Runtime     | Node.js 24 LTS, native ESM                | Current LTS; ESM is the standard module system                          |
| Framework   | Express 5                                 | Rejected promises auto-forward to the error handler — no asyncHandler   |
| Language    | TypeScript 5.9 (strict)                   | `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, NodeNext resolution |
| Validation  | Zod 4                                     | One schema = runtime validation + inferred types + OpenAPI docs         |
| API docs    | zod-to-openapi + Scalar at `/docs`        | Generated from the same schemas that validate requests — never drifts   |
| Config      | dotenv cascade + Zod-validated env        | Fails fast at boot on invalid/missing configuration                     |
| Logging     | pino + pino-http                          | Structured JSON, request-id correlation, redaction; pretty in dev       |
| ORM         | Sequelize 6 + mysql2                      | Team standard; typed models via `InferAttributes`                       |
| Migrations  | Synor (raw SQL, do/undo pairs)            | Same workflow as other ShopUp services                                  |
| Tests       | Vitest 4 + supertest                      | Jest-compatible API, native ESM/TS, much faster                         |
| Lint/format | ESLint 10 (flat, type-checked) + Prettier | typescript-eslint recommendedTypeChecked                                |
| Hooks       | husky + lint-staged                       | lint+format staged files on commit; typecheck+test on push              |

## Getting started

```sh
nvm use                  # Node 24 (.nvmrc)
npm install
cp .env.example .env.local   # adjust DB credentials if needed

# create the database, then run migrations
npm run mg:latest

npm run dev              # http://localhost:8080 — docs at /docs
```

## Scripts

```sh
npm run dev              # tsx watch mode
npm run build            # compile to dist/ (+ dist/commit.txt)
npm start                # run compiled app
npm run typecheck        # tsc --noEmit
npm run lint / lint:fix  # ESLint
npm run format           # Prettier
npm test                 # Vitest (test:watch, test:coverage)
npm run mg:new           # scaffold a do/undo SQL migration pair
npm run mg:newscaff      # scaffold a full model: migration pair + typed model class + registration
npm run mg:info          # migration status
npm run mg:latest        # apply pending migrations (out-of-order safe)
```

## Project structure

```
src/
├── index.ts                 # entrypoint: validate config → connect DB → listen
├── app.ts                   # createApp() factory: middleware pipeline
├── router.ts                # central route registry (one line per module)
├── config/
│   ├── env.ts               # .env file cascade (.env.{NODE_ENV}.local > .env.{NODE_ENV} > .env.local > .env)
│   └── index.ts             # Zod-validated typed config — the only place process.env is read
├── openapi/
│   ├── registry.ts          # OpenAPI registry + document generator
│   └── router.ts            # serves /openapi.json and /docs (Scalar UI)
├── common/
│   ├── errors/app-error.ts  # AppError + factories (badRequest, notFound, ...)
│   ├── logger/              # pino logger
│   ├── middlewares/         # error-handler, not-found, request-logger, validate
│   └── utils/               # graceful shutdown
├── db/
│   ├── index.ts             # Sequelize instance, model init, associations
│   └── models/              # one typed model class per file
└── modules/                 # feature modules (vertical slices)
    ├── health/              # /v1/health (liveness) + /v1/health/ready (readiness)
    └── users/               # reference module
        ├── users.router.ts  # HTTP layer: validate → call service → respond
        ├── users.schemas.ts # Zod schemas + OpenAPI registration
        ├── users.service.ts # business logic + DB access
        └── users.service.test.ts
```

## Conventions

**Layering (Controller → Service → Model):**

- **Router** — validates input with `validate(schemas)`, calls the service, shapes the response. No business logic.
- **Service** — business logic and DB access. Throws `AppError` for expected failures.
- **Model** — typed Sequelize classes. DDL lives in `schema-migrations/`; models never `sync()`.

**Errors:** throw `AppError.notFound(...)` / `.conflict(...)` etc. anywhere; the global error middleware
produces `{ "error": { "code", "message", "details?" } }`. Express 5 catches rejected promises from async
handlers automatically — never write try/catch just to call `next(err)`.

**Validation + docs:** every request shape is a Zod schema in the module's `*.schemas.ts`. The same schema
validates at runtime, gives you the TS type via `z.infer`, and is registered in the OpenAPI registry so
`/docs` is always accurate.

**Config:** add new env vars to `src/config/index.ts` (with validation + default) and `.env.example`. Never
read `process.env` elsewhere.

**Logging:** use `req.log` in request scope (carries the request id), `logger` elsewhere. No `console.log`.

**Routing:** versioned under `/v1`. Breaking changes ship as `/v2` alongside `/v1`.

**Adding a module:** copy `src/modules/users`, rename, add one `router.use(...)` line in `src/router.ts`,
scaffold the model + migration with `npm run mg:newscaff modelName=Thing`.

## Migrations

Raw SQL, managed by Synor, same as other ShopUp services. Every migration is a `do`/`undo` pair:

```sh
npm run mg:new           # prompts for purpose, creates {timestamp}.do.{title}.sql + undo
npm run mg:latest        # applies pending migrations (supports out-of-order across branches)
```

To scaffold a whole model in one command (migration pair with prefilled DDL, typed model class
in `src/db/models/`, and automatic registration in `src/db/index.ts`):

```sh
npm run mg:newscaff modelName=OrderItem                          # → table `order_items`
npm run mg:newscaff modelName=OrderItem tableName=my_own_name    # override the table name
```

Then add your columns to the generated `.do.` SQL file, mirror them in the model class, and run
`npm run mg:latest`. Registration in `src/db/index.ts` is driven by the `// models:*` marker
comments — keep them intact.

Synor config lives in `.synorrc.cjs` (CommonJS because the project is ESM) and reads the same `.env` cascade as the app.

## Health checks

- `GET /v1/health` — **liveness**: process is up. No dependency checks, so orchestrators don't restart the app when a dependency is down.
- `GET /v1/health/ready` — **readiness**: checks DB connectivity, returns 503 when degraded. Point load-balancer/k8s readiness probes here.

## Docker

```sh
docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) -t node-express-boilerplate .
docker run -p 8080:8080 --env-file .env.production node-express-boilerplate
```

Multi-stage build, dev dependencies pruned, runs as the unprivileged `node` user.

## Where auth goes

Auth is deliberately not included (it is service-specific at ShopUp — JWT/identity-service/session vary by service).
The intended seams: a session middleware in `src/common/middlewares/` registered in `app.ts`, plus a
`requirePermissions(...)` router-level middleware. Never commit keys — put them in env vars validated in `src/config`.
