import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'
import {
  createApprovedManufacturerProfile,
  loginUser,
  logoutUser,
  promoteUserToAdmin,
  registerUser,
} from '../helpers/users'

test('registers, restores the session, opens protected UI, and logs out', async ({ page }) => {
  const email = uniqueEmail()
  const displayName = 'Web E2E User'

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Аренда маленьких велосипедов/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveCount(0)
  await page.getByLabel('Имя').fill(displayName)
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeVisible()
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === 'web_app_demo_refresh' && cookie.httpOnly,
      ),
    )
    .toBe(true)

  const refreshAfterReload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') && response.request().method() === 'POST',
  )
  const meAfterReload = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/me') && response.request().method() === 'GET',
  )

  await page.reload()

  await expect((await refreshAfterReload).status()).toBe(200)
  await expect((await meAfterReload).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.getByRole('link', { name: 'Открыть профиль', exact: true }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  let releaseMeAfterReload!: () => void
  const meAfterReloadCanContinue = new Promise<void>((resolve) => {
    releaseMeAfterReload = resolve
  })

  await page.route('**/api/auth/me', async (route) => {
    await meAfterReloadCanContinue
    await route.continue()
  })

  const refreshAfterProtectedReload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') && response.request().method() === 'POST',
  )
  const meAfterProtectedReload = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/me') && response.request().method() === 'GET',
  )

  await page.reload()

  await expect((await refreshAfterProtectedReload).status()).toBe(200)
  await expect(page.getByText('Проверяем сессию...')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Нужен вход' })).toHaveCount(0)

  releaseMeAfterReload()

  await expect((await meAfterProtectedReload).status()).toBe(200)
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
  await page.unroute('**/api/auth/me')

  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: 'Доступ запрещен' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Нужен вход' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await page.getByRole('button', { name: 'Выйти из аккаунта' }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('redirectTo'))
    .toBe('/admin/users')
  await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Нужен вход' })).toHaveCount(0)
})

test('redirects guests from protected sections and returns after login', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-admin-return')

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)

  await page.goto('/admin/users')

  await expect(page).toHaveURL((url) => {
    return url.pathname === '/' && url.searchParams.get('redirectTo') === '/admin/users'
  })
  await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Нужен вход' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveCount(0)

  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(adminEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeVisible()
})

test('closes the mobile sidebar after navigation', async ({ page }) => {
  const email = uniqueEmail('web-e2e-mobile-sidebar')

  await registerUser(email)
  await page.setViewportSize({ width: 390, height: 844 })
  await loginUser(page, email)

  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const sidebarDialog = page.getByRole('dialog', { name: 'Боковое меню' })
  await expect(sidebarDialog).toBeVisible()

  await sidebarDialog.getByRole('link', { name: 'Каталог' }).click()

  await expect(page).toHaveURL(/\/bicycles/)
  await expect(sidebarDialog).not.toBeVisible()
})

test('admin manages users list roles and statuses', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-admin')
  const managedEmail = uniqueEmail('web-e2e-managed')

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)
  await registerUser(managedEmail)

  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(adminEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible()
  await expect(page.getByText(managedEmail)).toBeVisible()

  const roleSelect = page.getByLabel(`Роль для ${managedEmail}`)
  await roleSelect.selectOption('manufacturer')
  await expect(page.getByText(`${managedEmail}: пользователь обновлен`)).toBeVisible()
  await expect(roleSelect).toHaveValue('manufacturer')

  const statusSelect = page.getByLabel(`Статус для ${managedEmail}`)
  await statusSelect.selectOption('blocked')
  await expect(page.getByText(`${managedEmail}: пользователь обновлен`)).toBeVisible()
  await expect(statusSelect).toHaveValue('blocked')

  await page.goto('/admin/orders?quickFilter=orders_today&date=2026-05-13')
  await expect(page.getByRole('heading', { name: 'Заказы' })).toBeVisible()
  await expect(page.getByLabel('Быстрый фильтр заказов администратора')).toHaveValue('orders_today')
  await expect(page.getByLabel('Фильтр заказов администратора по дате')).toHaveValue('2026-05-13')
  await page.getByLabel('Быстрый фильтр заказов администратора').selectOption('unpaid_deposit')
  await expect(page).toHaveURL(/quickFilter=unpaid_deposit/)
  await page.goBack()
  await expect(page.getByLabel('Быстрый фильтр заказов администратора')).toHaveValue('orders_today')
  await expect(page.getByLabel('Фильтр заказов администратора по дате')).toHaveValue('2026-05-13')
})

test('manufacturer submits a profile and admin approves it', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-maker-admin')
  const manufacturerEmail = uniqueEmail('web-e2e-maker')
  const publicName = `Tiny Bikes ${Date.now()}`

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)

  await page.goto('/')
  await page.getByLabel('Тип аккаунта').getByRole('button', { name: 'Производитель' }).click()
  await page.getByLabel('Имя').fill('Tiny Bikes Maker')
  await page.getByLabel('Электронная почта').fill(manufacturerEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()
  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  await page.getByLabel('Юридическое название').fill(`${publicName} LLC`)
  await page.getByLabel('Публичное название').fill(publicName)
  await page.getByLabel('Контактная почта').fill(manufacturerEmail)
  await page.getByLabel('Телефон').fill('+7 999 000-00-00')
  await page.getByLabel('Регион').fill('Moscow')
  await page.getByLabel('Город').fill('Moscow')
  await page.getByLabel('Описание').fill('Small bicycles for rehearsals and performances.')
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await expect(page.getByText('Профиль сохранен как черновик')).toBeVisible()
  await page.getByRole('button', { name: 'Отправить на модерацию' }).click()
  await expect(page.getByText('Профиль отправлен на модерацию')).toBeVisible()

  await logoutUser(page)
  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(adminEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.goto('/admin/manufacturers')
  await expect(page.getByRole('heading', { name: 'Производители' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: publicName })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Одобрить' }).click()
  await expect(page.getByText(`${publicName}: профиль обновлен`)).toBeVisible()

  await logoutUser(page)
  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(manufacturerEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()
  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('button', { name: 'Отправить на модерацию' })).toBeDisabled()
})

test('manufacturer profile cache is isolated across account switches', async ({ page }) => {
  const firstEmail = uniqueEmail('web-e2e-cache-maker-a')
  const secondEmail = uniqueEmail('web-e2e-cache-maker-b')
  const firstPublicName = `Cache Maker A ${Date.now()}`

  await page.goto('/')
  await page.getByLabel('Тип аккаунта').getByRole('button', { name: 'Производитель' }).click()
  await page.getByLabel('Имя').fill('Cache Maker A')
  await page.getByLabel('Электронная почта').fill(firstEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  await page.getByLabel('Юридическое название').fill(`${firstPublicName} LLC`)
  await page.getByLabel('Публичное название').fill(firstPublicName)
  await page.getByLabel('Контактная почта').fill(firstEmail)
  await page.getByLabel('Телефон').fill('+7 999 111-11-11')
  await page.getByLabel('Регион').fill('Moscow')
  await page.getByLabel('Город').fill('Moscow')
  await page.getByLabel('Описание').fill('First manufacturer profile.')
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await expect(page.getByText('Профиль сохранен как черновик')).toBeVisible()
  await expect(page.getByLabel('Публичное название')).toHaveValue(firstPublicName)

  await logoutUser(page)
  await page.goto('/')
  await page.getByLabel('Тип аккаунта').getByRole('button', { name: 'Производитель' }).click()
  await page.getByLabel('Имя').fill('Cache Maker B')
  await page.getByLabel('Электронная почта').fill(secondEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  await expect(page.getByLabel('Публичное название')).toHaveValue('')
})

test('manufacturer submits a bicycle and admin publishes it to the catalog', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-bike-admin')
  const manufacturerEmail = uniqueEmail('web-e2e-bike-maker')
  const manufacturerName = `Bike Maker ${Date.now()}`
  const bicycleTitle = `Tiny Performer ${Date.now()}`

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)
  await registerUser(manufacturerEmail, 'manufacturer')
  await createApprovedManufacturerProfile(manufacturerEmail, manufacturerName)

  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(manufacturerEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.goto('/manufacturer/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  await page.getByLabel('Название').fill(bicycleTitle)
  await page.getByLabel('Цена за день, копейки').fill('250000')
  await page.getByLabel('Залог, копейки').fill('500000')
  await page.getByLabel('Город').fill('Moscow')
  await page.getByLabel('Регион').fill('Moscow')
  await page.getByLabel('Адрес самовывоза').fill('Main storage, door 2')
  await page.getByLabel('Максимальная нагрузка, кг').fill('12')
  await page.getByLabel('Высота сиденья, см').fill('22')
  await page.getByLabel('Длина рамы, см').fill('40')
  await page.getByLabel('Диаметр колеса, см').fill('16')
  await page.getByLabel('Доставка доступна').check()
  await page.getByLabel('Ссылки на фотографии').fill('https://example.com/bike.jpg')
  await page.getByLabel('Описание').fill('Compact bicycle for controlled circus rehearsals.')
  await page.getByLabel('Рекомендуемые габариты животного').fill('Small trained animals up to 70 cm height')
  await page.getByLabel('Примечания по безопасности').fill('Use only with trained handlers and indoor safety mats.')
  await page.getByRole('button', { name: 'Создать черновик' }).click()
  await expect(page.getByText(`${bicycleTitle}: черновик сохранен`)).toBeVisible()
  const bicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(bicycleRow).toBeVisible()
  await bicycleRow.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(`${bicycleTitle}: отправлен на модерацию`)).toBeVisible()

  await logoutUser(page)
  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(adminEmail)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()

  await page.goto('/admin/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  const adminRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(adminRow).toBeVisible()
  await adminRow.getByRole('button', { name: 'Одобрить' }).click()
  await expect(page.getByText(`${bicycleTitle}: велосипед обновлен`)).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByRole('link', { name: `Детали велосипеда ${bicycleTitle}` }).click()
  await expect(page.getByRole('heading', { name: bicycleTitle })).toBeVisible()
  await expect(page.getByText('Залог')).toBeVisible()
  await expect(page.getByText('Use only with trained handlers and indoor safety mats.')).toBeVisible()
})
