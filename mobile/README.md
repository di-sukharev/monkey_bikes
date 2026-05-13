# Mobile

Мобильное приложение Monkey Bikes на Expo и React Native. Поверхность активна для пользовательских сценариев аренды: вход, каталог, заявка, платежная заглушка и отслеживание заказов. Админские и производственные сценарии остаются web-first, пока их явно не перенесут в mobile.

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

Maestro smoke flow проверяет `register -> current user -> logout` по установленному development build.

```bash
bun run e2e:maestro:setup
export PATH="$HOME/.maestro/bin:$PATH"
bun run e2e:maestro
```

Перед запуском backend должен быть доступен по `EXPO_PUBLIC_API_URL`, с которым собран или запущен mobile bundle. Для runner preflight задайте `E2E_API_HEALTH_URL`, например `http://127.0.0.1:43180/health`.

Стабильные selectors лежат в `src/constants/testIds.ts`, flow - в `.maestro/flows/auth-smoke.yaml`, runner - в `scripts/e2e/run-maestro.mjs`. Подробный runbook: `../docs/TESTING.md`.

## Чего пока не хватает

- Продуктового каталога велосипедов в mobile: сейчас есть только auth shell.
- Экранов карточки велосипеда, фильтров, выбора дат и создания заявки.
- Мобильного просмотра своих заказов, оплаты через заглушку и статусов выдачи/возврата.
- Ролевой навигации для производителя и администратора, если решим переносить эти сценарии в mobile.
- Финальных иконок/splash assets под бренд Monkey Bikes; текущие assets еще шаблонные.

## Практика

Для серверного состояния используйте TanStack Query, для форм - TanStack Form, для валидации - общие Zod-схемы. Refresh token хранится в `expo-secure-store` на native; access token хранится только в памяти приложения.
