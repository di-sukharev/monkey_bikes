# Deployment

Этот проект деплоится в DigitalOcean через `doctl` после выбора облака и GitHub source. Локальная разработка из `README.md` не требует DigitalOcean.

Текущий production-план:

- Source repo: `di-sukharev/monkey_bikes`.
- Branch: `master`.
- Backend: App Platform service из `backend/Dockerfile`.
- Web: App Platform Static Site, сборка `bun run build:web`, публикация `web/dist`.
- Landing: App Platform Static Site, сборка `bun run build:landing`, публикация `landing/dist`.
- Database: DigitalOcean Managed PostgreSQL в `fra1`.
- App Platform region: `fra`.

Не храните production secrets в репозитории. Конкретные app specs с реальными URL и секретами держите только локально, например в `.scratch/`.

## Prerequisites

1. `doctl` уже авторизован:

```bash
doctl account get
```

2. DigitalOcean имеет доступ к GitHub repo `di-sukharev/monkey_bikes`.
3. В GitHub `master` лежит весь monorepo, а не только bootstrap `README.md`:

```bash
git push -u origin master
```

Минимально в repo должны быть `backend/`, `web/`, `landing/`, `packages/contracts/`, `package.json` и `bun.lock`.

## Static Site build model

DigitalOcean App Platform Static Sites не принимают локальный `dist` как артефакт через `doctl apps create`. App Platform читает Git-source, запускает `build_command` и публикует `output_dir`.

Для этого repo:

- web: `build_command: bun install --frozen-lockfile && bun run build:web`, `output_dir: web/dist`;
- landing: `build_command: bun install --frozen-lockfile && bun run build:landing`, `output_dir: landing/dist`;
- web должен иметь `catchall_document: index.html`, потому что это SPA на TanStack Router.

## Managed PostgreSQL

Создайте production database cluster:

```bash
doctl databases create bicycle-rent-pg \
  --region fra1 \
  --size db-s-1vcpu-1gb \
  --num-nodes 1
```

Backend App Platform spec подключает этот cluster как database component `bicycle-rent-db` и использует bindable variable:

```yaml
DATABASE_URL=${bicycle-rent-db.DATABASE_URL}
```

Если cluster уже существует, не создавайте второй. Используйте тот же `cluster_name` в backend spec.

## App specs

Commit-safe templates находятся в `.do/`:

- `.do/backend-app.yaml.example`
- `.do/web-static-app.yaml.example`
- `.do/landing-static-app.yaml.example`

Перед деплоем готовьте concrete specs только в `.scratch/`, подставляйте реальные значения через helper script и не коммитьте concrete specs.

Для первого backend deploy, когда web URL еще неизвестен:

```bash
JWT_SECRET="$(openssl rand -hex 32)" \
bun run deploy:do:specs backend-initial
```

После создания backend app подготовьте web static spec:

```bash
DO_BACKEND_URL="https://<backend-default-ingress>" \
bun run deploy:do:specs web
```

После создания web app подготовьте финальный backend CORS spec и landing spec:

```bash
JWT_SECRET="<same-secret-used-for-first-backend-deploy>" \
DO_WEB_URL="https://<web-default-ingress>" \
bun run deploy:do:specs backend-final

DO_WEB_URL="https://<web-default-ingress>" \
bun run deploy:do:specs landing
```

The script refuses empty YAML `value:` fields and unresolved `REPLACE_WITH_*` placeholders. This prevents the common shell-substitution mistake where a non-exported env var silently writes an empty `JWT_SECRET`, `CORS_ORIGINS`, `VITE_API_URL`, or `PUBLIC_WEB_APP_URL`.

Если по какой-то причине готовите specs вручную, проверьте эти замены:

- `REPLACE_WITH_AT_LEAST_32_RANDOM_CHARS` на production `JWT_SECRET`;
- `https://REPLACE_WITH_WEB_DEFAULT_INGRESS` временно на `https://placeholder.invalid` для первого backend deploy, затем на реальный web URL.

В `.scratch/deploy/web-static-app.yaml` замените:

- `https://REPLACE_WITH_BACKEND_DEFAULT_INGRESS` на backend default ingress.

В `.scratch/deploy/landing-static-app.yaml` замените:

- `https://REPLACE_WITH_WEB_DEFAULT_INGRESS` на web default ingress.

Проверяйте specs перед созданием apps:

```bash
doctl apps spec validate .scratch/deploy/backend-app.yaml
doctl apps spec validate .scratch/deploy/web-static-app.yaml
doctl apps spec validate .scratch/deploy/landing-static-app.yaml
```

## Deployment order

### 1. Backend first deploy

Для первого backend deploy используйте временный `CORS_ORIGINS=https://placeholder.invalid`, потому что web URL еще неизвестен.

```bash
doctl apps create \
  --spec .scratch/deploy/backend-app.yaml \
  --format ID,DefaultIngress,ActiveDeployment.ID \
  --wait
```

Сохраните backend app id и default ingress:

```bash
export DO_BACKEND_APP_ID=<backend-app-id>
export DO_BACKEND_URL=https://<backend-default-ingress>
```

Backend app содержит `PRE_DEPLOY` job `migrate`, который выполняет:

```bash
bun run prisma:deploy
```

### 2. Web Static Site

Подставьте `DO_BACKEND_URL` в `VITE_API_URL` внутри `.scratch/deploy/web-static-app.yaml`, затем создайте web app:

```bash
doctl apps create \
  --spec .scratch/deploy/web-static-app.yaml \
  --format ID,DefaultIngress,ActiveDeployment.ID \
  --wait
```

Сохраните web app id и default ingress:

```bash
export DO_WEB_APP_ID=<web-app-id>
export DO_WEB_URL=https://<web-default-ingress>
```

### 3. Backend CORS update

Вернитеcь в `.scratch/deploy/backend-app.yaml` и замените `CORS_ORIGINS` на точный web origin:

```yaml
CORS_ORIGINS: https://<web-default-ingress>
```

Затем обновите backend app:

```bash
doctl apps update "$DO_BACKEND_APP_ID" \
  --spec .scratch/deploy/backend-app.yaml \
  --format ID,DefaultIngress,ActiveDeployment.ID \
  --wait
```

### 4. Landing Static Site

Подставьте `DO_WEB_URL` в `PUBLIC_WEB_APP_URL` внутри `.scratch/deploy/landing-static-app.yaml`, затем создайте landing app:

```bash
doctl apps create \
  --spec .scratch/deploy/landing-static-app.yaml \
  --format ID,DefaultIngress,ActiveDeployment.ID \
  --wait
```

## Production env contract

Backend production env:

```bash
PORT=8080
APP_ENV=production
DATABASE_URL=${bicycle-rent-db.DATABASE_URL}
JWT_SECRET=<at-least-32-random-characters>
CORS_ORIGINS=https://<web-default-ingress>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECURE=true
PAYMENT_PROVIDER=stub
PAYMENT_STUB_DEV_ENDPOINTS_ENABLED=false
PAYMENT_CURRENCY=RUB
```

`JWT_SECRET` вставляется именно в production backend env: либо перед генерацией
`.scratch/deploy/backend-app.yaml` через `JWT_SECRET="$(openssl rand -hex 32)"`,
либо в переменную `JWT_SECRET` backend-сервиса в DigitalOcean App Platform.
`openssl rand -hex 32` генерирует 32 случайных байта, записанных как 64
hex-символа. Не используйте placeholder из `.env.example` и человеческие фразы.

Production web auth depends on cross-origin cookies between the web static host and backend host. In production the backend sets the HttpOnly refresh cookie as `Secure` and `SameSite=None`; cookie-based refresh/logout requests also require an `Origin` that matches `CORS_ORIGINS`. Do not weaken CORS or cookie security to work around browser failures.

## Seed first admin

Do not commit seed credentials. Use a temporary App Platform console/job with backend env and a one-time password:

```bash
# Example only: provide real values in the remote console/job environment, not in git.
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD=<temporary-strong-password> \
SEED_ADMIN_DISPLAY_NAME="Admin" \
SEED_ADMIN_ALLOW_NON_LOCAL=true \
bun run seed:admin
```

After login, rotate the password through the product/admin process when available.

## Validation

Recommended local preflight before cloud deploy:

```bash
bun run typecheck
bun run build:backend
bun run build:web
bun run build:landing
```

Cloud checks after deploy:

```bash
curl "$DO_BACKEND_URL/health"
curl -I "$DO_WEB_URL/"
curl -I "$DO_WEB_URL/admin"
```

Manual smoke:

- web root loads;
- direct SPA route `/admin` returns the static app shell;
- register/login works;
- reload keeps session through refresh cookie;
- logout clears session;
- landing root links to web catalog/admin/manufacturer routes.

If auth refresh fails on default `*.ondigitalocean.app` hostnames, fix the cookie/CORS behavior before calling the deployment complete.

## Template deployment failure modes to prevent

These issues occurred during the first DigitalOcean deployment and should stay covered by the template:

- DigitalOcean App Platform must be connected to GitHub before `doctl apps create`; otherwise the API returns `GitHub user not authenticated`.
- The GitHub branch used by App Platform must contain the full monorepo, not only bootstrap files; Static Sites build from Git source, not from a locally uploaded `dist`.
- Backend Docker builds with `bun install --frozen-lockfile` must copy every workspace `package.json` before install, including `landing/package.json`.
- Backend App Platform config must set both `http_port: 8080` and runtime `PORT=8080`; do not rely on implicit port behavior.
- Concrete specs must be generated with non-empty values; empty `JWT_SECRET` causes backend startup failure, empty `CORS_ORIGINS` removes CORS allow-origin headers, empty `VITE_API_URL` makes the static web app call its own `/api/*`, and empty `PUBLIC_WEB_APP_URL` breaks landing links.
- Web and landing Static Site build commands should run `bun install --frozen-lockfile && bun run build:*`; App Platform build cache can otherwise reuse stale `node_modules` and produce incompatible Vite/plugin TypeScript errors.
- DigitalOcean Managed PostgreSQL URLs use `sslmode=require`; with the Prisma `@prisma/adapter-pg` stack this project normalizes that URL to include `uselibpqcompat=true`, avoiding TLS failures against the managed database certificate chain.
- Cross-origin web auth on default `*.ondigitalocean.app` hosts requires exact backend `CORS_ORIGINS`, frontend `credentials: 'include'`, and refresh cookies with `HttpOnly`, `Secure`, and `SameSite=None`.
- Do not call deployment complete until a real browser smoke proves registration, refresh-after-reload, and logout on the deployed web/API hosts.

## Useful logs

```bash
doctl apps logs "$DO_BACKEND_APP_ID" api --type build --tail 200
doctl apps logs "$DO_BACKEND_APP_ID" api --type deploy --tail 200
doctl apps logs "$DO_BACKEND_APP_ID" api --type run --tail 200
```

For deployment history:

```bash
doctl apps list-deployments "$DO_BACKEND_APP_ID"
```

## References

- App Spec: https://docs.digitalocean.com/products/app-platform/reference/app-spec/
- Static Sites: https://docs.digitalocean.com/products/app-platform/how-to/manage-static-sites/
- Bun Buildpack: https://docs.digitalocean.com/products/app-platform/reference/buildpacks/bun/
- `doctl apps`: https://docs.digitalocean.com/reference/doctl/reference/apps/
- Managed PostgreSQL create: https://docs.digitalocean.com/reference/doctl/reference/databases/create/
