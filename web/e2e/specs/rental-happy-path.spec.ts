import type { Page } from '@playwright/test'
import { expect, test, uniqueEmail } from '../helpers/test'
import { futureDateOnly } from '../helpers/dates'
import { readRentalOrderSnapshot, resetE2eDatabase } from '../helpers/database'
import {
  createApprovedManufacturerProfile,
  loginUser,
  logoutUser,
  promoteUserToAdmin,
  registerUser,
} from '../helpers/users'

test('completes the rental happy path from catalog request to returned order', async ({ page }) => {
  await resetE2eDatabase()

  const runId = Date.now().toString(36)
  const adminEmail = uniqueEmail('web-e2e-rental-admin')
  const manufacturerEmail = uniqueEmail('web-e2e-rental-maker')
  const renterEmail = uniqueEmail('web-e2e-rental-customer')
  const manufacturerName = `Rental Maker ${runId}`
  const bicycleTitle = `Rental Performer ${runId}`
  const startsOn = futureDateOnly(14)
  const endsOn = futureDateOnly(15)

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)
  await registerUser(manufacturerEmail, 'manufacturer')
  await registerUser(renterEmail)
  await createApprovedManufacturerProfile(manufacturerEmail, manufacturerName)

  await loginUser(page, manufacturerEmail)
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
  await page.getByLabel('Описание').fill('Compact bicycle for controlled rehearsals.')
  await page.getByLabel('Рекомендуемые габариты животного').fill('Small trained animals up to 70 cm height')
  await page.getByLabel('Примечания по безопасности').fill('Use only with trained handlers and indoor safety mats.')
  await page.getByRole('button', { name: 'Создать черновик' }).click()
  await expect(page.getByText(`${bicycleTitle}: черновик сохранен`)).toBeVisible()
  const bicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(bicycleRow).toBeVisible()
  await bicycleRow.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(`${bicycleTitle}: отправлен на модерацию`)).toBeVisible()

  await logoutUser(page)
  await loginUser(page, adminEmail)
  await page.goto('/admin/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  const adminBicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(adminBicycleRow).toBeVisible()
  await adminBicycleRow.getByRole('button', { name: 'Одобрить' }).click()
  await expect(page.getByText(`${bicycleTitle}: велосипед обновлен`)).toBeVisible()

  await logoutUser(page)
  await loginUser(page, renterEmail)
  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByRole('link', { name: `Детали велосипеда ${bicycleTitle}` }).click()
  await expect(page.getByRole('heading', { name: bicycleTitle })).toBeVisible()
  await page.getByRole('link', { name: 'Запросить аренду' }).click()
  await expect(page.getByRole('heading', { name: 'Создать заявку' })).toBeVisible()
  await page.getByLabel('Дата начала').fill(startsOn)
  await page.getByLabel('Дата окончания').fill(endsOn)
  await page.getByLabel('Имя контактного лица').fill('Trainer')
  await page.getByLabel('Телефон контактного лица').fill('+7 999 111-22-33')
  await page.getByLabel('Комментарий').fill('Keep the bicycle indoors.')
  await page.getByLabel('Правила безопасности приняты').check()
  await page.getByRole('button', { name: 'Создать заявку' }).click()
  await expect(page.getByText('Заявка создана')).toBeVisible()
  await page.getByRole('link', { name: 'Открыть заявку' }).click()
  await expect(page.getByRole('heading', { name: 'Заявка на аренду' })).toBeVisible()

  const orderId = page.url().match(/\/orders\/([^/?#]+)/)?.[1] ?? ''
  expect(orderId).not.toBe('')
  await expect(page.getByText('Заявка', { exact: true })).toBeVisible()

  await logoutUser(page)
  await loginUser(page, adminEmail)
  await page.goto(`/admin/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Заказ администратора' })).toBeVisible()
  await expect(page.getByText('Макс. нагрузка 12 кг', { exact: true })).toBeVisible()
  await page.getByLabel('Комментарий администратора к заказу').fill('Approved for rehearsal.')
  await page.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(page.getByText('Заказ: Подтверждена')).toBeVisible()

  await logoutUser(page)
  await loginUser(page, renterEmail)
  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Заявка на аренду' })).toBeVisible()
  await expect(page.getByText('Подтверждена', { exact: true })).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Велосипеды', exact: true })).toBeVisible()
  const unavailableCatalogResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())

    return (
      response.request().method() === 'GET' &&
      url.pathname === '/api/bicycles' &&
      url.searchParams.get('startsOn') === startsOn &&
      url.searchParams.get('endsOn') === endsOn
    )
  })
  await fillDateFilter(page, 'Дата начала', startsOn)
  await fillDateFilter(page, 'Дата окончания', endsOn)
  await expect((await unavailableCatalogResponse).status()).toBe(200)
  await expect(page.getByText('Велосипеды не найдены.')).toBeVisible()
  await expect(page.getByText(bicycleTitle)).not.toBeVisible()

  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Заявка на аренду' })).toBeVisible()
  await expect(page.getByText('Подтверждена', { exact: true })).toBeVisible()
  await page.getByLabel('Создать платеж Аренда').click()
  await expect(page.getByText('Аренда: Ожидает')).toBeVisible()
  await page.getByLabel('Отметить платеж Аренда как успешный').click()
  await expect(page.getByText('Аренда: Успешен')).toBeVisible()
  await page.getByLabel('Создать платеж Залог').click()
  await expect(page.getByText('Залог: Ожидает')).toBeVisible()
  await page.getByLabel('Отметить платеж Залог как успешный').click()
  await expect(page.getByText('Залог: Успешен')).toBeVisible()
  await expect(page.getByText('оплачено', { exact: true })).toBeVisible()

  await logoutUser(page)
  await loginUser(page, adminEmail)
  await page.goto(`/admin/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Заказ администратора' })).toBeVisible()
  await expect(page.getByText('оплачено', { exact: true })).toBeVisible()
  await page.getByLabel(`Комментарий чеклиста: выдача для ${bicycleTitle}`).fill('Issued in clean condition.')
  await page.getByRole('button', { name: 'Выдать заказ' }).click()
  await expect(page.getByText('Заказ: Выдана')).toBeVisible()
  await page.getByLabel(`Комментарий чеклиста: возврат для ${bicycleTitle}`).fill('Returned in clean condition.')
  await page.getByRole('button', { name: 'Вернуть заказ' }).click()
  await expect(page.getByText('Заказ: Возвращена')).toBeVisible()

  const checklistsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Чеклисты' }) })
  const issueChecklistRow = checklistsSection.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'Выдача' })
  const returnChecklistRow = checklistsSection.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'Возврат' })
  await expect(issueChecklistRow).toBeVisible()
  await expect(issueChecklistRow.filter({ hasText: 'Без изменений' })).toBeVisible()
  await expect(returnChecklistRow).toBeVisible()
  await expect(returnChecklistRow.filter({ hasText: 'Без изменений' })).toBeVisible()

  const historyTable = page.locator('table').filter({ hasText: 'Переход' })
  await expect(historyTable.getByRole('row').filter({ hasText: 'Заявка' }).filter({ hasText: 'Подтверждена' })).toBeVisible()
  await expect(historyTable.getByRole('row').filter({ hasText: 'Подтверждена' }).filter({ hasText: 'Выдана' })).toBeVisible()
  await expect(historyTable.getByRole('row').filter({ hasText: 'Выдана' }).filter({ hasText: 'Возвращена' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'Доступен' })).toBeVisible()

  await logoutUser(page)
  await loginUser(page, renterEmail)
  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Заявка на аренду' })).toBeVisible()
  await expect(page.getByText('Возвращена', { exact: true })).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByText(bicycleTitle)).toBeVisible()

  const orderSnapshot = await readRentalOrderSnapshot(orderId)
  const paymentsByType = new Map(orderSnapshot.payments.map((payment) => [payment.type, payment]))
  expect(orderSnapshot.status).toBe('returned')
  expect(orderSnapshot.statusHistory.map((entry) => entry.toStatus)).toEqual(['confirmed', 'issued', 'returned'])
  expect(orderSnapshot.payments).toHaveLength(2)
  expect(paymentsByType.get('rent')).toMatchObject({
    amountKopecks: 500000,
    currency: 'RUB',
    provider: 'stub',
    status: 'succeeded',
    type: 'rent',
  })
  expect(paymentsByType.get('deposit')).toMatchObject({
    amountKopecks: 500000,
    currency: 'RUB',
    provider: 'stub',
    status: 'succeeded',
    type: 'deposit',
  })
  expect(orderSnapshot.checklists.map((checklist) => checklist.type)).toEqual(['issue', 'return'])
  expect(orderSnapshot.checklists.map((checklist) => checklist.safetyAction)).toEqual(['none', 'none'])
  expect(orderSnapshot.items[0]?.bicycle.status).toBe('available')
})

async function fillDateFilter(page: Page, label: string, value: string) {
  const input = page.getByLabel(label)

  await input.fill(value)
  await input.dispatchEvent('input', { bubbles: true })
  await input.dispatchEvent('change', { bubbles: true })
  await expect(input).toHaveValue(value)
}
