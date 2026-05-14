# Testing

Цель тестов в шаблоне - дать будущим агентам понятный пример, где проверять поведение, а где не раздувать E2E.

## Пирамида

- Backend unit/integration: контракты, env parsing, JWT, password hashing, refresh rotation, auth guards, стабильный error shape.
- Web Playwright: короткие happy-path E2E через настоящий backend и Vite UI.
- Mobile Maestro: короткие happy-path smoke flows по установленному Expo development build.

Негативные матрицы валидации, edge cases и чистые правила должны жить в unit/integration tests. Client E2E нужен для главных пользовательских цепочек: нажал кнопку, прошёл реальный API flow, увидел устойчивое состояние.

## Backend

```bash
bun run test:backend
bun run test:backend:integration
bun run test:web
bun run --cwd backend prisma:validate
bun run smoke:backend:docker
```

Backend tests находятся рядом с backend-кодом и проверяют contracts/services/routes. Integration runner по умолчанию поднимает `postgres_test`, применяет migrations и прогоняет все `*.integration.test.ts`. По умолчанию test DB port вычисляется от абсолютного пути репозитория, чтобы параллельные checkout-ы не конфликтовали; задайте `POSTGRES_TEST_PORT`, если нужен фиксированный порт.

В этом проекте обычная dev database живет в Homebrew PostgreSQL на
`localhost:5432`. Чтобы integration tests тоже шли через локальный Homebrew
PostgreSQL без Docker, используйте отдельную базу с suffix `_test`:

```bash
TEST_SKIP_DOCKER=1 \
DATABASE_URL_TEST="postgresql://<postgres-user>:<postgres-password>@localhost:5432/bicycle_monkey_rent_test?schema=public" \
bun run test:backend:integration
```

`TEST_DATABASE_URL` поддерживается как совместимый алиас, но в проектной `.env` используется `DATABASE_URL_TEST`. Integration runner отказывается запускаться на базе без suffix `_test`, если явно не задан `TEST_ALLOW_NON_TEST_DATABASE=1`.

Docker smoke собирает backend image, стартует его против `postgres_test`, ждёт `/health` и удаляет только свой smoke-контейнер. Он не берет `DATABASE_URL_TEST`/`TEST_DATABASE_URL` неявно, потому что host migrations и Docker container должны указывать на одну и ту же БД. Для кастомной БД задавайте парой `BACKEND_DOCKER_SMOKE_HOST_DATABASE_URL` и `BACKEND_DOCKER_SMOKE_DATABASE_URL`; оба URL должны вести в `*_test` с одинаковой schema, если явно не включен `BACKEND_DOCKER_SMOKE_ALLOW_NON_TEST_DATABASE=1`.

## Web E2E

Playwright настроен в `web/playwright.config.ts`.

```bash
bun run --cwd web e2e:install
bun run e2e:web
```

Что делает web E2E:

- читает `DATABASE_URL_TEST` и `JWT_SECRET` из `backend/.env`, если они не заданы в shell;
- требует `DATABASE_URL_TEST` или совместимый alias `TEST_DATABASE_URL`;
- использует только локальную PostgreSQL test database из env и не запускает Docker;
- выбирает хешированные порты от пути checkout-а, а если они уже заняты, автоматически берет ближайшие свободные в своем диапазоне;
- генерирует Prisma client и применяет миграции;
- очищает E2E-данные в test database перед браузерным прогоном;
- поднимает backend отдельно на `E2E_BACKEND_PORT` (по умолчанию диапазон `50000-52999`);
- поднимает Vite отдельно на `E2E_WEB_PORT` (по умолчанию диапазон `56000-58999`);
- прогоняет браузерные smoke-сценарии auth session, admin user management, manufacturer profile moderation, изоляции manufacturer profile cache между аккаунтами и публикации велосипеда в публичный каталог.

Полезные env:

```bash
DATABASE_URL_TEST="postgresql://<postgres-user>:<postgres-password>@localhost:5432/bicycle_monkey_rent_test?schema=public"
E2E_BACKEND_PORT=<backend-port>
E2E_WEB_PORT=<web-port>
E2E_BACKEND_URL=http://127.0.0.1:<backend-port>
E2E_WEB_URL=http://127.0.0.1:<web-port>
```

По умолчанию Playwright берет `DATABASE_URL_TEST` из shell или `backend/.env`; проектный локальный путь - Homebrew PostgreSQL на `localhost:5432` и база `bicycle_monkey_rent_test`. Backend и web URL синхронизируются с выбранными портами и прокидываются в backend `PORT`, frontend `VITE_API_URL` и Playwright `baseURL`. Если ручные `E2E_BACKEND_PORT`/`E2E_WEB_PORT` совпали, URL и порт не совпали между собой, или выбранный ручной порт уже занят, запуск останавливается до старта серверов с явной ошибкой. Playwright откажется запускаться на базе без suffix `_test`, чтобы E2E случайно не писал в dev/prod данные. Web E2E использует `DATABASE_URL_TEST`/`TEST_DATABASE_URL`, а не dev `DATABASE_URL`.

Playwright artifacts лежат в `web/e2e/.artifacts/` и не коммитятся. Для интерактивной отладки:

```bash
bun run --cwd web e2e:ui
```

## Mobile Maestro E2E

Maestro flows находятся в `mobile/.maestro/flows/*.yaml`, runner - `mobile/scripts/e2e/run-maestro.mjs`.

Установка CLI:

```bash
bun run --cwd mobile e2e:maestro:setup
export PATH="$HOME/.maestro/bin:$PATH"
maestro --version
```

Prerequisites:

- Java 17+;
- Xcode/iOS Simulator для iOS или Android Studio/emulator для Android;
- установленный Expo development build с `bundleIdentifier/package` `com.dimasukharev.monkeybikes`;
- backend доступен по тому `EXPO_PUBLIC_API_URL`, с которым собран или запущен bundle.
- для runner preflight задайте host-reachable `E2E_API_HEALTH_URL`, например `http://127.0.0.1:43180/health`.

Development build пример:

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:43180 bunx eas-cli build --profile development --platform ios
EXPO_PUBLIC_API_URL=http://127.0.0.1:43180 bunx eas-cli build --profile development-simulator --platform ios
EXPO_PUBLIC_API_URL=http://10.0.2.2:43180 bunx eas-cli build --profile development --platform android
```

### Expo dev client + Maestro runbook

Для локального визуального прогона на iOS Simulator используйте установленный
Expo development build, backend на host-reachable URL и Metro dev-client bundle.
Не запускайте эти flows через Expo Go: Maestro будет видеть Expo launcher, а не
приложение.

1. Соберите и установите development build для симулятора:

```bash
(
  cd mobile
  EXPO_PUBLIC_API_URL=http://127.0.0.1:43180 bunx eas-cli build --profile development-simulator --platform ios
)
```

После завершения EAS build скачайте `.tar.gz`, распакуйте `.app` и установите
его в booted simulator:

```bash
xcrun simctl install booted /path/to/MonkeyBikes.app
```

2. Запустите backend и убедитесь, что `/health` доступен с того host, который
увидит simulator:

```bash
bun run --cwd backend dev
curl http://127.0.0.1:43180/health
```

3. Запустите Metro в dev-client режиме. Для симулятора обычно работает
`127.0.0.1`; если устройство или среда не видит localhost, используйте LAN IP.
`EXPO_PUBLIC_E2E=1` включает только тестовые упрощения для local E2E bundle
например обычный password input вместо secure field, а любой bundle без этой
переменной остается с `secureTextEntry`.

```bash
HOST_IP="$(ipconfig getifaddr en0 || echo 127.0.0.1)"
(
  cd mobile
  EXPO_PUBLIC_API_URL="http://$HOST_IP:43180" \
  EXPO_PUBLIC_E2E=1 \
  bunx expo start --dev-client --host lan --port 43185
)
```

4. Запустите Maestro через dev-client URL. Runner сам сформирует ссылку вида
`exp+monkey-bikes://expo-development-client/?url=<encoded metro url>`, если
задан `MAESTRO_DEV_SERVER_URL`. При переносе шаблона на другой slug/scheme
обновите этот URL в runner вместе с `app.json`.

```bash
PATH="$HOME/.maestro/bin:$PATH" \
EXPO_PUBLIC_API_URL="http://$HOST_IP:43180" \
E2E_API_HEALTH_URL="http://$HOST_IP:43180/health" \
MAESTRO_DEV_SERVER_URL="http://$HOST_IP:43185" \
MAESTRO_DEVICE="<simulator-name-or-udid>" \
MAESTRO_REQUIRE_ORDER_FLOW=1 \
bun run --cwd mobile e2e:maestro
```

Запуск smoke flow:

```bash
bun run --cwd mobile e2e:maestro
```

Полезные env:

```bash
MAESTRO_DEVICE="iPhone 16 Pro"
MAESTRO_APP_ID=com.dimasukharev.monkeybikes
E2E_DISPLAY_NAME="Mobile E2E User"
E2E_EMAIL="mobile-e2e@example.com"
E2E_PASSWORD=password123
E2E_API_HEALTH_URL=http://127.0.0.1:43180/health
```

Mobile E2E использует `testID` selectors из `mobile/src/constants/testIds.ts`; новые flows должны добавлять стабильные selectors в UI, а не полагаться на хрупкие координаты. Текстовые selectors допустимы для финальных пользовательских сообщений. Auth smoke проверяет public catalog, register, session restore after app relaunch и logout. Runner также запускает order request smoke, если backend catalog probe находит публичный велосипед; для обязательной проверки заявки задайте `MAESTRO_REQUIRE_ORDER_FLOW=1`, а для auth-only smoke - `MAESTRO_SKIP_ORDER_FLOW=1`.

### Подводные камни Mobile E2E

- `launchApp` после `clearState` или `stopApp` не гарантирует загрузку Metro
  bundle в Expo dev client. Для dev client всегда открывайте приложение через
  `openLink` с `MAESTRO_DEV_SERVER_URL`; обычный `launchApp` может оставить
  симулятор на home screen или на launcher.
- Backend и Metro URL должны быть достижимы из simulator/device. Если
  `localhost` ведет не туда, используйте LAN IP и прокиньте один и тот же host
  в `EXPO_PUBLIC_API_URL`, `E2E_API_HEALTH_URL` и `MAESTRO_DEV_SERVER_URL`.
- Secure password fields на iOS могут быть флейковыми для Maestro: команда
  `inputText` завершается успешно, но controlled React Native state остается
  пустым. Для E2E допускается test-only gate вроде `EXPO_PUBLIC_E2E=1`, где
  password field становится обычным `TextInput`; production bundle не должен
  включать этот режим.
- `hideKeyboard` ненадежен в React Native flows. Предпочитайте тап по
  статичному тексту, `keyboardDismissMode="on-drag"` на `ScrollView` и явный
  `scrollUntilVisible` до следующего элемента.
- Интерактивные элементы должны иметь touch target минимум 44-48 pt. Маленькие
  кастомные checkbox/radio rows визуально нажимаются человеком, но Maestro
  будет промахиваться или тапать по краю.
- Для кастомных RN checkbox на `Pressable` поле `checked` в Maestro hierarchy
  может не отражать реальное состояние. Проверяйте тот accessibility value,
  который реально есть в hierarchy, например `"checkbox, checked"`, или
  добавляйте стабильный `testID`/state marker.
- `scrollUntilVisible` может посчитать частично видимый CTA доступным и тапнуть
  в область за нижней границей экрана. Для финальных кнопок используйте
  `centerElement: true` или дополнительный scroll до полностью видимого
  состояния.
- После перестройки Expo Router маршрутов обязательно чистите starter tabs
  (`/explore`, `/index`) и используйте object-form navigation для dynamic/query
  routes. Typed routes должны проходить `bun run --cwd mobile typecheck` до E2E.
- Order smoke должен запускаться только при готовых данных каталога. Runner
  делает backend health/catalog preflight; используйте
  `MAESTRO_REQUIRE_ORDER_FLOW=1`, когда отсутствие публичного велосипеда должно
  считаться ошибкой среды, и `MAESTRO_SKIP_ORDER_FLOW=1` для auth-only smoke.

## Источники

- Playwright: `webServer`, `baseURL`, traces/screenshots/video - https://playwright.dev/docs/test-webserver и https://playwright.dev/docs/test-use-options
- Playwright CLI/browser install - https://playwright.dev/docs/test-cli и https://playwright.dev/docs/browsers
- Maestro CLI install/run - https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli и https://docs.maestro.dev/maestro-cli/run-your-first-test-with-the-maestro-cli
- Maestro selectors and launch reset - https://docs.maestro.dev/api-reference/selectors и https://docs.maestro.dev/reference/commands-available/launchapp
