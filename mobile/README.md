# Mobile

Мобильное приложение Monkey Bikes на Expo и React Native. Поверхность реализует клиентские сценарии аренды: публичный каталог, карточку велосипеда, создание заявки, платежную заглушку, список заказов, детали заказа и профиль клиента. Админские и производственные сценарии намеренно остаются web-first.

## Стек

- Expo SDK 55
- React Native
- TypeScript
- Expo Router
- TanStack Query
- TanStack Form
- Expo SecureStore
- Zod contracts из `@web-app-demo/contracts`
- EAS development builds
- Maestro E2E smoke flow

## EAS

Проект привязан к Expo account `dima-sukharev`:

- full name: `@dima-sukharev/monkey-bikes`
- project ID: `00aceb31-9425-4837-b928-5a70d5b64d45`
- URL: https://expo.dev/accounts/dima-sukharev/projects/monkey-bikes
- iOS bundle ID / Android package: `com.dimasukharev.monkeybikes`
- URL scheme: `monkeybikes`

Проверка привязки:

```bash
bunx eas-cli whoami
bunx eas-cli project:info
```

## Команды

```bash
bun run dev
bun run android
bun run ios
bun run web
bun run typecheck
bun run lint
bun run build
bun run e2e:maestro
```

Из корня репозитория используйте `bun run dev:mobile`, `bun run build:mobile` и `bun run typecheck:mobile`.

## Env

Создайте `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:43180
```

Для iOS simulator обычно подходит:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:43180
```

На Android emulator используйте:

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:43180
```

`EXPO_PUBLIC_*` переменные попадают в клиентский bundle, поэтому не кладите туда секреты.

## Development Build

`expo-dev-client` уже установлен. Нативные `ios` и `android` папки не хранятся в репозитории; их генерирует Expo prebuild/development build workflow.

```bash
bunx eas-cli build --profile development --platform android
bunx eas-cli build --profile development-simulator --platform ios
```

Если нужен iOS build для физического устройства, используйте профиль `development` и будьте готовы к Apple credentials/device registration:

```bash
bunx eas-cli build --profile development --platform ios
```

Перед сборкой можно явно задать API URL:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:43180 bunx eas-cli build --profile development-simulator --platform ios
EXPO_PUBLIC_API_URL=http://10.0.2.2:43180 bunx eas-cli build --profile development --platform android
```

## Maestro E2E

Maestro smoke flow проверяет `public catalog -> client register -> session restore -> logout`. Если backend catalog probe находит хотя бы один публичный велосипед, runner дополнительно запускает `public catalog -> select bicycle -> register client -> create order -> order detail`.

```bash
bun run e2e:maestro:setup
export PATH="$HOME/.maestro/bin:$PATH"
bun run e2e:maestro
```

Перед запуском backend должен быть доступен по `EXPO_PUBLIC_API_URL`, с которым собран или запущен mobile bundle. Для runner preflight задайте `E2E_API_HEALTH_URL`, например `http://127.0.0.1:43180/health`.

Полезные флаги:

- `MAESTRO_SKIP_ORDER_FLOW=1` - запустить только auth smoke.
- `MAESTRO_REQUIRE_ORDER_FLOW=1` - считать отсутствие публичного велосипеда ошибкой тестовой среды.

Стабильные selectors лежат в `src/constants/testIds.ts`, flows - в `.maestro/flows/*.yaml`, runner - в `scripts/e2e/run-maestro.mjs`. Подробный runbook: `../docs/TESTING.md`.

## Границы клиента

- Mobile поддерживает только роль клиента (`user`). Если в приложение входит администратор или производитель, экран сообщает, что мобильная поверхность доступна только клиентам, и предлагает выйти.
- Публичный каталог доступен без входа. Создание заявки, просмотр заказов, отмена заявки и платежная заглушка требуют клиентской сессии.
- Контактные данные пока вводятся в каждой заявке отдельно: текущий backend хранит их в заказе, а не в редактируемом клиентском профиле.
- Финальные иконки/splash assets под бренд Monkey Bikes еще остаются отдельной задачей.

## Практика

Для серверного состояния используйте TanStack Query, для форм - TanStack Form, для валидации - общие Zod-схемы. Refresh token хранится в `expo-secure-store` на native; access token хранится только в памяти приложения.
