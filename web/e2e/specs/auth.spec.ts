import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'
import { createPrisma } from '../../../backend/src/db'
import { defaultBackendPort, testDatabaseUrl } from '../env'

const backendUrl = process.env.E2E_BACKEND_URL ?? `http://127.0.0.1:${defaultBackendPort}`
const databaseUrl = testDatabaseUrl

test('registers, restores the session, opens protected UI, and logs out', async ({ page }) => {
  const email = uniqueEmail()
  const displayName = 'Web E2E User'

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /auth, validation/i })).toBeVisible()
  await page.getByLabel('Name').fill(displayName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.getByRole('link', { name: 'Open app' }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('heading', { name: 'Login required' })).toBeVisible()

  await page.getByRole('link', { name: 'Go to auth' }).click()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})

test('admin manages users list roles and statuses', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-admin')
  const managedEmail = uniqueEmail('web-e2e-managed')

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)
  await registerUser(managedEmail)

  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByText(managedEmail)).toBeVisible()

  const roleSelect = page.getByLabel(`Role for ${managedEmail}`)
  await roleSelect.selectOption('manufacturer')
  await expect(page.getByText(`${managedEmail} updated`)).toBeVisible()
  await expect(roleSelect).toHaveValue('manufacturer')

  const statusSelect = page.getByLabel(`Status for ${managedEmail}`)
  await statusSelect.selectOption('blocked')
  await expect(page.getByText(`${managedEmail} updated`)).toBeVisible()
  await expect(statusSelect).toHaveValue('blocked')
})

test('manufacturer submits a profile and admin approves it', async ({ page }) => {
  const adminEmail = uniqueEmail('web-e2e-maker-admin')
  const manufacturerEmail = uniqueEmail('web-e2e-maker')
  const publicName = `Tiny Bikes ${Date.now()}`

  await registerUser(adminEmail)
  await promoteUserToAdmin(adminEmail)

  await page.goto('/')
  await page.getByLabel('Account type').getByRole('button', { name: 'Manufacturer' }).click()
  await page.getByLabel('Name').fill('Tiny Bikes Maker')
  await page.getByLabel('Email').fill(manufacturerEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()
  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByLabel('Legal name').fill(`${publicName} LLC`)
  await page.getByLabel('Public name').fill(publicName)
  await page.getByLabel('Contact email').fill(manufacturerEmail)
  await page.getByLabel('Phone').fill('+7 999 000-00-00')
  await page.getByLabel('Region').fill('Moscow')
  await page.getByLabel('City').fill('Moscow')
  await page.getByLabel('Description').fill('Small bicycles for rehearsals and performances.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Profile saved as draft')).toBeVisible()
  await page.getByRole('button', { name: 'Submit for moderation' }).click()
  await expect(page.getByText('Profile submitted for moderation')).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/admin/manufacturers')
  await expect(page.getByRole('heading', { name: 'Manufacturers' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: publicName })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(`${publicName} updated`)).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(manufacturerEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()
  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('button', { name: 'Submit for moderation' })).toBeDisabled()
})

test('manufacturer profile cache is isolated across account switches', async ({ page }) => {
  const firstEmail = uniqueEmail('web-e2e-cache-maker-a')
  const secondEmail = uniqueEmail('web-e2e-cache-maker-b')
  const firstPublicName = `Cache Maker A ${Date.now()}`

  await page.goto('/')
  await page.getByLabel('Account type').getByRole('button', { name: 'Manufacturer' }).click()
  await page.getByLabel('Name').fill('Cache Maker A')
  await page.getByLabel('Email').fill(firstEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByLabel('Legal name').fill(`${firstPublicName} LLC`)
  await page.getByLabel('Public name').fill(firstPublicName)
  await page.getByLabel('Contact email').fill(firstEmail)
  await page.getByLabel('Phone').fill('+7 999 111-11-11')
  await page.getByLabel('Region').fill('Moscow')
  await page.getByLabel('City').fill('Moscow')
  await page.getByLabel('Description').fill('First manufacturer profile.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Profile saved as draft')).toBeVisible()
  await expect(page.getByLabel('Public name')).toHaveValue(firstPublicName)

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Account type').getByRole('button', { name: 'Manufacturer' }).click()
  await page.getByLabel('Name').fill('Cache Maker B')
  await page.getByLabel('Email').fill(secondEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/manufacturer/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByLabel('Public name')).toHaveValue('')
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
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(manufacturerEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

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
  await page.getByLabel('Description').fill('Compact bicycle for controlled circus rehearsals.')
  await page.getByLabel('Recommended animal dimensions').fill('Small trained animals up to 70 cm height')
  await page.getByLabel('Safety notes').fill('Use only with trained handlers and indoor safety mats.')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByText(`${bicycleTitle} saved as draft`)).toBeVisible()
  const bicycleRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(bicycleRow).toBeVisible()
  await bicycleRow.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText(`${bicycleTitle} submitted for moderation`)).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/admin/bicycles')
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  const adminRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(adminRow).toBeVisible()
  await adminRow.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(`${bicycleTitle} updated`)).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByRole('heading', { name: 'Bicycles', exact: true })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByRole('link', { name: `Details for ${bicycleTitle}` }).click()
  await expect(page.getByRole('heading', { name: bicycleTitle })).toBeVisible()
  await expect(page.getByText('Deposit')).toBeVisible()
  await expect(page.getByText('Use only with trained handlers and indoor safety mats.')).toBeVisible()

  const renterEmail = uniqueEmail('web-e2e-renter')
  await registerUser(renterEmail)

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(renterEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/bicycles')
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByRole('link', { name: `Details for ${bicycleTitle}` }).click()
  await expect(page.getByRole('heading', { name: bicycleTitle })).toBeVisible()
  await page.getByRole('link', { name: 'Request rental' }).click()
  await expect(page.getByRole('heading', { name: 'Create request' })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()
  await page.getByLabel('Starts on').fill('2026-05-12')
  await page.getByLabel('Ends on').fill('2026-05-13')
  await page.getByLabel('Contact name').fill('Trainer')
  await page.getByLabel('Contact phone').fill('+7 999 111-22-33')
  await page.getByLabel('Comment').fill('Keep the bicycles indoors.')
  await page.getByLabel('Safety rules accepted').check()
  await page.getByRole('button', { name: 'Create request' }).click()
  await expect(page.getByText('Request created')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'My orders' }).click()
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible()
  await expect(page.getByText(bicycleTitle)).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/admin/orders')
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  const orderRow = page.getByRole('row').filter({ hasText: bicycleTitle })
  await expect(orderRow).toBeVisible()
  await orderRow.getByRole('link', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { name: 'Admin order' })).toBeVisible()
  await expect(page.getByText('Max load 12 kg', { exact: true })).toBeVisible()
  await page.getByLabel('Admin order comment').fill('Approved for rehearsal.')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Order confirmed')).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await page.goto('/')
  await page.getByLabel('Auth mode').getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(renterEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Session is active' })).toBeVisible()

  await page.goto('/orders')
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: bicycleTitle }).getByText('confirmed')).toBeVisible()

  await page.goto('/bicycles')
  await page.getByRole('link', { name: `Details for ${bicycleTitle}` }).click()
  await page.getByRole('link', { name: 'Request rental' }).click()
  await page.getByLabel('Starts on').fill('2026-06-01')
  await page.getByLabel('Ends on').fill('2026-06-01')
  await page.getByLabel('Contact name').fill('Trainer')
  await page.getByLabel('Contact phone').fill('+7 999 111-22-33')
  await page.getByLabel('Safety rules accepted').check()
  await page.getByRole('button', { name: 'Create request' }).click()
  await expect(page.getByText('Request created')).toBeVisible()
  await page.getByRole('link', { name: 'Open request' }).click()
  await expect(page.getByRole('heading', { name: 'Rental request' })).toBeVisible()
  await page.getByLabel('Cancellation comment').fill('Schedule changed.')
  await page.getByRole('button', { name: 'Cancel request' }).click()
  await expect(page.getByText('Request cancelled')).toBeVisible()
})

async function registerUser(email: string, role: 'manufacturer' | 'user' = 'user') {
  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
    },
    body: JSON.stringify({
      email,
      password: e2ePassword,
      displayName: email.split('@')[0],
      role,
    }),
  })

  expect(response.status).toBe(201)
}

async function promoteUserToAdmin(email: string) {
  const prisma = createPrisma(databaseUrl)

  try {
    await prisma.user.update({
      where: { email },
      data: {
        role: 'admin',
        status: 'active',
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function createApprovedManufacturerProfile(email: string, publicName: string) {
  const prisma = createPrisma(databaseUrl)

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
    })

    await prisma.manufacturerProfile.create({
      data: {
        userId: user.id,
        legalName: `${publicName} LLC`,
        publicName,
        region: 'Moscow',
        city: 'Moscow',
        phone: '+7 999 000-00-00',
        email,
        description: 'Approved manufacturer profile for bicycle E2E.',
        status: 'approved',
        reviewedAt: new Date(),
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}
