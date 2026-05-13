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

- web: `build_command: bun run build:web`, `output_dir: web/dist`;
- landing: `build_command: bun run build:landing`, `output_dir: landing/dist`;
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

Перед деплоем скопируйте их в `.scratch/`, подставьте реальные значения и не коммитьте concrete specs:

```bash
mkdir -p .scratch/deploy
cp .do/backend-app.yaml.example .scratch/deploy/backend-app.yaml
cp .do/web-static-app.yaml.example .scratch/deploy/web-static-app.yaml
cp .do/landing-static-app.yaml.example .scratch/deploy/landing-static-app.yaml
```

В `.scratch/deploy/backend-app.yaml` замените:

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

Production web auth depends on cross-origin cookies between the web static host and backend host. In production the backend sets the HttpOnly refresh cookie as `Secure` and `SameSite=None`; do not weaken CORS or cookie security to work around browser failures.

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
