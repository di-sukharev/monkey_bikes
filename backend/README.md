# Backend

Backend-слой шаблона для API, auth, интеграций и серверной бизнес-логики. Web и mobile опираются на один контракт данных из `packages/contracts`.

## Стек

- Bun
- Hono
- Prisma 7
- PostgreSQL
- Zod
- jose JWT
- TypeScript

## Команды

Из папки `backend`:

```bash
cp .env.example .env
brew services start postgresql@14
bun run dev
bun run typecheck
bun run test
bun run test:unit
bun run test:integration
bun run smoke:docker
bun run prisma:validate
bun run prisma:generate
bun run prisma:migrate
bun run prisma:deploy
```

Из корня репозитория используйте `bun run dev:backend`, `bun run build:backend`, `bun run typecheck:backend` и `bun run test:backend`.

Локальный dev-server по умолчанию слушает `http://localhost:43180`.

## Локальная БД

Для обычной разработки этот проект использует Homebrew PostgreSQL на стандартном
порту `5432`, а не Docker Compose port `54329`.

Проверьте сервис:

```bash
brew services list
brew services start postgresql@14
psql -h localhost -p 5432 -U <postgres-user> -d postgres
```

В `backend/.env` должны быть заданы локальные базы:

```bash
DATABASE_URL="postgresql://<postgres-user>:<postgres-password>@localhost:5432/bicycle_monkey_rent?schema=public"
DATABASE_URL_TEST="postgresql://<postgres-user>:<postgres-password>@localhost:5432/bicycle_monkey_rent_test?schema=public"
```

Если базы еще не созданы:

```bash
createdb -h localhost -p 5432 -U <postgres-user> bicycle_monkey_rent
createdb -h localhost -p 5432 -U <postgres-user> bicycle_monkey_rent_test
bun run prisma:deploy
```

Backend загружает `backend/.env` через `dotenv`, а Prisma config берет
`DATABASE_URL` из этого же файла. Поэтому миграции и dev-server должны смотреть
на одну и ту же Homebrew database.

`bun run test:integration` по умолчанию поднимает `postgres_test` из `../docker-compose.yml`, применяет Prisma migrations к `web_app_demo_test` и запускает DB-backed API tests. Для локальной Homebrew test database задайте `TEST_SKIP_DOCKER=1`; runner использует `DATABASE_URL_TEST` из `backend/.env`, а `TEST_DATABASE_URL` остается совместимым алиасом. Integration runner отказывается работать с базой без suffix `_test`, если явно не задан `TEST_ALLOW_NON_TEST_DATABASE=1`.

`bun run smoke:docker` собирает backend Docker image, стартует его против `postgres_test`, ждёт `/health` и затем удаляет только созданный smoke-контейнер. Smoke-runner намеренно использует Docker Compose test database по умолчанию; если нужно заменить БД, задайте парой `BACKEND_DOCKER_SMOKE_HOST_DATABASE_URL` и `BACKEND_DOCKER_SMOKE_DATABASE_URL`, чтобы миграции и контейнер смотрели на одну `*_test` базу с одинаковой schema.

## Auth API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /openapi.json`

Пароли хешируются через `Bun.password` с Argon2id. Access token - короткоживущий JWT через `jose`. Refresh token - opaque random token; в базе хранится только SHA-256 hash, refresh делает rotation и отзывает старую session.

Локального администратора создает команда `bun run seed:admin` из переменных
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` и `SEED_ADMIN_DISPLAY_NAME`. Команда
идемпотентна: существующий пользователь с этим email обновляется до
`role=admin` и `status=active`, без создания auth-сессий. Пароль нужно задать
явно; известные example-пароли отклоняются, а non-local database URL требует
явного `SEED_ADMIN_ALLOW_NON_LOCAL=true`.

Для ручного наполнения тестового приложения есть отдельный скрипт
`bun run seed:demo-data`. Он создает тестовые данные для просмотра: админа,
производителя, пользователя, профиль производителя, несколько велосипедов и
демо заказы. Перед запуском задайте `SEED_DEMO_PASSWORD` в `.env`; пароли будут
сформированы как `<SEED_DEMO_PASSWORD>-admin`,
`<SEED_DEMO_PASSWORD>-manufacturer`, `<SEED_DEMO_PASSWORD>-customer`.
Скрипт ориентирован на локальное использование; для non-local БД нужно явно
указать `SEED_DEMO_ALLOW_NON_LOCAL=true`.

```bash
bun run seed:admin
```

```bash
bun run seed:demo-data
```

## Архитектура

`src/index.ts` только загружает env, создаёт Prisma client и запускает Bun server. Hono app создаётся в `src/app.ts`. Auth feature живёт в `src/auth`: routes валидируют и делегируют, service владеет session/user логикой, token helpers изолируют JWT и refresh-token механику.

Prisma migration SQL не пишется руками. Меняйте `prisma/schema.prisma`, затем запускайте `bun run prisma:migrate`.
