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
    └── example/             # reference module — copy it to start a new module
        ├── example.router.ts    # HTTP layer: authorize → validate → service → respond
        ├── example.schemas.ts   # Zod schemas + OpenAPI registration
        ├── example.service.ts   # business logic + DB access
        └── example.service.test.ts
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

**Adding a module:** copy `src/modules/example`, rename, add one `router.use(...)` line in `src/router.ts`,
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
- `GET /v1/health/ready` — **readiness**: checks DB connectivity (and Redis when configured), returns 503 when degraded. Point load-balancer/k8s readiness probes here.

## Docker

```sh
docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) -t node-express-boilerplate .
docker run -p 8080:8080 --env-file .env.production node-express-boilerplate
```

Multi-stage build, dev dependencies pruned, runs as the unprivileged `node` user.

## Auth

Auth is delegated to ShopUp's central **identity service** — the same one shopup-lite uses. This
service never stores credentials, issues tokens, or manages roles; it only consumes them.

**Resolving the caller** — the global `sessionMiddleware` (in `app.ts`) populates `req.user` from,
in order:

1. `Authorization: jwt <token>` — an identity-service-issued RS256 JWT, verified **locally**
   against `AUTH_JWT_PUBLIC_KEY` (base64 public key, subject `auth`, payload
   `{ data: { user: { id, roleIds, scopeIds, permissions? } } }`). No network call.
2. `Authorization: bearer <token>` (or `X-Access-Token`) — an identity-service session token,
   resolved via `GET /v0/user` on the identity service (forwarding the caller's credentials),
   cached per token for `AUTH_CACHE_TTL_SECONDS` (Redis when `REDIS_URL` is set, in-memory otherwise).
3. Signed, httpOnly auth cookie — same resolution; invalid cookies are cleared.

The middleware never rejects; enforcement is per-route, with both of shopup-lite's styles:

```ts
// Permission style (middlewares/authorize.ts)
authorize(); // 401 unless authenticated
authorize({ only: 'examples:create' }); // 403 unless the permission is granted
authorize({ oneOf: ['a:read', 'a:x'] }); // at least one required
authorizeRoles(['SYSADMIN']); // role keys → identity role ids (roleIdByKey)

// Guard style (middlewares/security.ts — shopup-lite's services/security.js)
router.use(isAuthenticated);
adminRouter.use([isAuthenticated, onlySuperAdmin]);
```

**Permission checks**: a JWT's `permissions` claim is checked locally; bearer callers are checked
via `POST /v0/user/permissions/check` on the identity service, forwarding their own auth header —
exactly shopup-lite's flow. Role checks use `req.user.roleIds` against the static `roleIdByKey`
map (`src/common/libs/auth.ts` — keep in sync with the identity service's role table).

**Identity client** (`src/common/libs/identity-api.ts`): native `fetch`, request timeout, and a
per-token cache keyed by sha256 of the auth header (`src/common/libs/cache.ts` — Redis-backed when
`REDIS_URL` is configured, in-memory otherwise; Redis errors degrade to cache misses, never
failures). Extend it with more `/v0` endpoints
(roles, scopes, users) as needed. If the identity service is unreachable, requests proceed
unauthenticated — public routes keep working, protected routes 401.

**Endpoints**: only `GET /v1/auth/me` (current principal). Login, registration, logout and
password management happen against the identity service directly.

**Local development** — either point `IDENTITY_SERVICE_URL` at staging, or set `AUTH_SKIP=true`
to inject a SYSADMIN principal (config rejects it in production; production also requires
`IDENTITY_SERVICE_URL` and/or `AUTH_JWT_PUBLIC_KEY`, and a non-default `COOKIE_SECRET`).

Deliberately not carried over from shopup-lite: hardcoded bypass tokens, `JIMMY_IDENTITY`,
whitelisted URLs, the `{ isError, body }` envelope, and 403-for-everything (401 vs 403 are used
correctly here).
