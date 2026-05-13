# Web

Браузерный клиент шаблона. Здесь уже есть минимальный auth-flow, который задаёт пример для будущих web-фич.

## Стек

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui primitives with a local Neobrutalism theme
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
VITE_API_URL=http://localhost:43180
```

## Практика

Для серверного состояния используйте TanStack Query, для форм - TanStack Form, для валидации - общие Zod-схемы из `packages/contracts`. Access token хранится только в памяти клиента; refresh идёт через HttpOnly cookie, выставленную backend.

UI-примитивы лежат в `src/components/ui` и остаются локальным shadcn/ui-кодом, адаптированным под Neobrutalism CSS-variable тему. Сохраняйте совместимый API текущих primitives (`Button`, `Card`, `Field`, `Input`, `Table`, `NativeSelect`, `Alert` и т.д.) и не переписывайте экраны под upstream-варианты, если локальная совместимость уже решает задачу. Новые экраны должны сначала использовать существующие компоненты и сохранять настоящую HTML-семантику поверх визуальных primitives. Новые shadcn-компоненты добавляйте из директории `web`, затем приводите их визуальный слой к этой теме:

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
