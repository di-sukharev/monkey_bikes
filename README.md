# Vibe Coding Template

Шаблон для быстрого старта web/mobile продуктов: один репозиторий с готовым backend, browser-клиентом, Expo-приложением и общими API-контрактами. Цель шаблона - дать AI-агентам чистую начальную архитектуру, чтобы новые фичи продолжали писаться по уже заданным границам.

## Install With a Codex Agent

When installing this template from a GitHub URL in a fresh Codex session, give the agent this initial prompt:

```text
Install this repository into the project. First read README.md, AGENTS.md, and docs/*.md. Before setup, ask me what I want to build first, which surfaces I need now (web, mobile, backend/API, or full-stack), and whether I need deployment now. If deployment is needed, ask whether to use DigitalOcean or Yandex Cloud. Do not require cloud credentials for local development.
```

Local development does not require DigitalOcean or Yandex Cloud. Cloud tokens, `doctl auth init`, `yc init`, registry access, managed PostgreSQL, and Expo/EAS/App Store/Google Play accounts are needed only when the user chooses deployment or mobile release work. This project uses the local Homebrew PostgreSQL on the standard `5432` port for day-to-day backend development. The agent may create local uncommitted `.env` files from `.env.example`, generate a local-only `JWT_SECRET`, apply migrations, and run validation. Anything that requires external authorization or a paid account must be called out before the agent attempts it.

## Что внутри

- `backend` - Bun + Hono + Prisma + PostgreSQL, custom JWT auth, Zod validation, OpenAPI.
- `web` - React + Vite + Tailwind CSS + локальная shadcn/ui Neobrutalism-тема + TanStack Query/Form/Router, готовый auth-flow.
- `landing` - отдельный Astro-проект для статической landing-страницы.
- `mobile` - Expo + React Native + Expo Router + TanStack Query/Form, auth-flow с SecureStore.
- `packages/contracts` - общие Zod-схемы и TypeScript-типы API.
- `docker-compose.yml` - optional PostgreSQL services for Docker-based test/smoke runs. Обычная локальная разработка в этом проекте использует Homebrew PostgreSQL на `localhost:5432`.
- `docs/TESTING.md` - backend, Playwright и Maestro testing contract.

## Быстрый старт

Основной локальный путь для этого репозитория - уже установленный PostgreSQL через Homebrew:

```bash
bun install
cp backend/.env.example backend/.env
brew services start postgresql@14
createdb -h localhost -p 5432 -U <postgres-user> bicycle_monkey_rent
createdb -h localhost -p 5432 -U <postgres-user> bicycle_monkey_rent_test
bun run --cwd backend prisma:deploy
bun run dev:backend
bun run dev:web
bun run dev:landing
bun run dev:mobile
```

После `cp backend/.env.example backend/.env` замените `YOUR_POSTGRES_USER` и
`YOUR_POSTGRES_PASSWORD` на локальную роль PostgreSQL. Dev database должна быть
`bicycle_monkey_rent`, test database - `bicycle_monkey_rent_test`, обе на
`localhost:5432`. Не используйте `54329` для обычного dev-запуска: этот порт
относится только к старому Docker Compose варианту.

Для web можно создать `web/.env`:

```bash
VITE_API_URL=http://localhost:3000
```

Для Expo можно создать `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

На Android emulator вместо localhost обычно нужен `http://10.0.2.2:3000`.

`backend/.env.example` также содержит локальные `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD` и `SEED_ADMIN_DISPLAY_NAME`; перед запуском `seed:admin`
задайте свой локальный пароль. Команда создает или обновляет эту учетную
запись с ролью `admin` и по умолчанию работает только с локальной БД.

```bash
bun run --cwd backend seed:admin
```

## Основные команды

- `bun run dev` - запустить workspace-проекты в dev-режиме параллельно.
- `bun run dev:landing` - запустить Astro landing-проект.
- `bun run typecheck` - TypeScript-проверка всех workspace-проектов.
- `bun run typecheck:landing` - Astro typecheck landing-проекта.
- `bun run build` - build/typecheck/export проектов, где есть build-скрипт.
- `bun run build:landing` - production build landing-проекта.
- `bun run test:backend` - backend unit/integration tests.
- `bun run test:backend:integration` - DB-backed auth/manufacturer API tests через `postgres_test` или `DATABASE_URL_TEST`.
- `bun run e2e:web` - Playwright auth/admin/manufacturer smoke через backend + Vite.
- `bun run e2e:mobile` - Maestro auth smoke по установленному mobile build.
- `bun run --cwd backend seed:admin` - создать или обновить локального администратора.
- `bun run --cwd backend prisma:migrate` - создать/применить Prisma migration в dev.
- `bun run --cwd backend prisma:deploy` - применить готовые миграции на сервере.

## Архитектурные ориентиры

Контракты API живут в `packages/contracts` и импортируются всеми слоями. Backend валидирует вход через эти Zod-схемы, web/mobile используют их же в TanStack Form и API-клиентах.

Backend устроен по потоку `route -> validation -> auth/session guard -> service -> Prisma -> DTO`. Routes остаются тонкими, бизнес-логика auth живёт в feature service, а `src/index.ts` только поднимает Bun server.

Web UI строится на Tailwind CSS v4 и локальных shadcn/ui-примитивах из `web/src/components/ui`, адаптированных под Neobrutalism CSS-variable тему. Старые shadcn token names и варианты компонентов сохранены как совместимый API, но новые web-экраны должны использовать существующие primitives (`Button`, `Card`, `Field`, `Input`, `Table`, `NativeSelect`, `Alert` и т.д.), сохранять semantic HTML поверх визуальных primitives и не копировать ad hoc CSS вместо design-system слоя.

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), тесты: [docs/TESTING.md](docs/TESTING.md), деплой: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
