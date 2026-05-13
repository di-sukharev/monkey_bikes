import { expect, test, uniqueEmail } from '../helpers/test'
import { futureDateOnly } from '../helpers/dates'
import { readRentalOrderSnapshot, resetE2eDatabase } from '../helpers/database'
import {
  createApprovedManufacturerProfile,
  loginUser,
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
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  await page.getByLabel('Title').fill(bicycleTitle)
  await page.getByLabel('Daily price, kopecks').fill('250000')
  await page.getByLabel('Deposit, kopecks').fill('500000')
  await page.getByLabel('City').fill('Moscow')
  await page.getByLabel('Region').fill('Moscow')
  await page.getByLabel('Pickup address').fill('Main storage, door 2')
  await page.getByLabel('Max load, kg').fill('12')
  await page.getByLabel('Seat height, cm').fill('22')
  await page.getByLabel('Frame length, cm').fill('40')
  await page.getByLabel('Wheel diameter, cm').fill('16')
  await page.getByLabel('Delivery available').check()
  await page.getByLabel('Photo URLs').fill('https://example.com/bike.jpg')
  await page.getByLabel('Description').fill('Compact bicycle for controlled rehearsals.')
  await page.getByLabel('Recommended animal dimensions').fill('Small trained animals up to 70 cm height')
  await page.getByLabel('Safety notes').fill('Use only with trained handlers and indoor safety mats.')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByText(`${bicycleTitle} saved as draft`)).toBeVisible()
  const bicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(bicycleRow).toBeVisible()
  await bicycleRow.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText(`${bicycleTitle} submitted for moderation`)).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, adminEmail)
  await page.goto('/admin/bicycles')
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  const adminBicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(adminBicycleRow).toBeVisible()
  await adminBicycleRow.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(`${bicycleTitle} updated`)).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, renterEmail)
  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByRole('link', { name: `Details for ${bicycleTitle}` }).click()
  await expect(page.getByRole('heading', { name: bicycleTitle })).toBeVisible()
  await page.getByRole('link', { name: 'Request rental' }).click()
  await expect(page.getByRole('heading', { name: 'Create request' })).toBeVisible()
  await page.getByLabel('Starts on').fill(startsOn)
  await page.getByLabel('Ends on').fill(endsOn)
  await page.getByLabel('Contact name').fill('Trainer')
  await page.getByLabel('Contact phone').fill('+7 999 111-22-33')
  await page.getByLabel('Comment').fill('Keep the bicycle indoors.')
  await page.getByLabel('Safety rules accepted').check()
  await page.getByRole('button', { name: 'Create request' }).click()
  await expect(page.getByText('Request created')).toBeVisible()
  await page.getByRole('link', { name: 'Open request' }).click()
  await expect(page.getByRole('heading', { name: 'Rental request' })).toBeVisible()

  const orderId = page.url().match(/\/orders\/([^/?#]+)/)?.[1] ?? ''
  expect(orderId).not.toBe('')
  await expect(page.getByText('request', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, adminEmail)
  await page.goto(`/admin/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Admin order' })).toBeVisible()
  await expect(page.getByText('Max load 12 kg', { exact: true })).toBeVisible()
  await page.getByLabel('Admin order comment').fill('Approved for rehearsal.')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Order confirmed')).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, renterEmail)
  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Rental request' })).toBeVisible()
  await expect(page.getByText('confirmed', { exact: true })).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  await page.getByLabel('Starts on').fill(startsOn)
  await page.getByLabel('Ends on').fill(endsOn)
  await expect(page.getByText('No bicycles found.')).toBeVisible()
  await expect(page.getByText(bicycleTitle)).not.toBeVisible()

  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Rental request' })).toBeVisible()
  await expect(page.getByText('confirmed', { exact: true })).toBeVisible()
  await page.getByLabel('Create Rent payment').click()
  await expect(page.getByText('Rent payment pending')).toBeVisible()
  await page.getByLabel('Mark Rent payment as succeeded').click()
  await expect(page.getByText('Rent payment succeeded')).toBeVisible()
  await page.getByLabel('Create Deposit payment').click()
  await expect(page.getByText('Deposit payment pending')).toBeVisible()
  await page.getByLabel('Mark Deposit payment as succeeded').click()
  await expect(page.getByText('Deposit payment succeeded')).toBeVisible()
  await expect(page.getByText('paid', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, adminEmail)
  await page.goto(`/admin/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Admin order' })).toBeVisible()
  await expect(page.getByText('paid', { exact: true })).toBeVisible()
  await page.getByLabel(`Issue checklist comment for ${bicycleTitle}`).fill('Issued in clean condition.')
  await page.getByRole('button', { name: 'Issue order' }).click()
  await expect(page.getByText('Order issued')).toBeVisible()
  await page.getByLabel(`Return checklist comment for ${bicycleTitle}`).fill('Returned in clean condition.')
  await page.getByRole('button', { name: 'Return order' }).click()
  await expect(page.getByText('Order returned')).toBeVisible()

  const checklistsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Checklists' }) })
  const issueChecklistRow = checklistsSection.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'Issue' })
  const returnChecklistRow = checklistsSection.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'Return' })
  await expect(issueChecklistRow).toBeVisible()
  await expect(issueChecklistRow.filter({ hasText: 'No change' })).toBeVisible()
  await expect(returnChecklistRow).toBeVisible()
  await expect(returnChecklistRow.filter({ hasText: 'No change' })).toBeVisible()

  const historyTable = page.locator('table').filter({ hasText: 'Transition' })
  await expect(historyTable.getByRole('row').filter({ hasText: 'request' }).filter({ hasText: 'confirmed' })).toBeVisible()
  await expect(historyTable.getByRole('row').filter({ hasText: 'confirmed' }).filter({ hasText: 'issued' })).toBeVisible()
  await expect(historyTable.getByRole('row').filter({ hasText: 'issued' }).filter({ hasText: 'returned' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: bicycleTitle }).filter({ hasText: 'available' })).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await loginUser(page, renterEmail)
  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Rental request' })).toBeVisible()
  await expect(page.getByText('returned', { exact: true })).toBeVisible()

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
