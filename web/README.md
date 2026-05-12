# Web

Браузерный клиент шаблона. Здесь уже есть минимальный auth-flow, который задаёт пример для будущих web-фич.

## Стек

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- TanStack Form
- TanStack Router
- Zod contracts из `@web-app-demo/contracts`
- Playwright
- ESLint

## Команды

```bash
bun run dev
bun run build
bun run typecheck
bun run lint
bun run e2e
bun run e2e:ui
```

Из корня репозитория используйте `bun run dev:web`, `bun run build:web` и `bun run typecheck:web`.

## Env

Создайте `web/.env` при необходимости:

```bash
VITE_API_URL=http://localhost:3000
```

## Практика

Для серверного состояния используйте TanStack Query, для форм - TanStack Form, для валидации - общие Zod-схемы из `packages/contracts`. Access token хранится только в памяти клиента; refresh идёт через HttpOnly cookie, выставленную backend.

UI-примитивы лежат в `src/components/ui` и сгенерированы через shadcn/ui. Этот шаблон намеренно содержит полный registry для discoverability, но новые экраны должны сначала использовать уже существующие компоненты оттуда (`Button`, `Card`, `Field`, `Input`, `Table`, `NativeSelect`, `Alert` и т.д.) и сохранять настоящую HTML-семантику поверх визуальных primitives. Новые shadcn-компоненты добавляйте из директории `web`:

```bash
bunx shadcn@latest add <component>
```

## E2E

Playwright smoke находится в `e2e/specs/auth.spec.ts` и проверяет auth session, admin user management и manufacturer profile moderation через реальные backend/API вызовы.

Первый запуск:

```bash
bun run e2e:install
bun run e2e
```

Подробный runbook: `../docs/TESTING.md`.
