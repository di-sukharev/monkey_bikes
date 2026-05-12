import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'
import { createPrisma } from '../../../backend/src/db'
import { defaultBackendPort, defaultDatabaseUrl } from '../env'

const backendUrl = process.env.E2E_BACKEND_URL ?? `http://127.0.0.1:${defaultBackendPort}`
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl

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
  await page.getByRole('button', { name: 'Login' }).click()
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Login' }).click()

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

async function registerUser(email: string) {
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
