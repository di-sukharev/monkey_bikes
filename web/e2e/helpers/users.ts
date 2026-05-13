import { expect, type Page } from '@playwright/test'
import { createPrisma } from '../../../backend/src/db'
import { defaultBackendUrl, testDatabaseUrl } from '../env'
import { e2ePassword } from './test'

const backendUrl = defaultBackendUrl
const databaseUrl = testDatabaseUrl

export async function registerUser(email: string, role: 'manufacturer' | 'user' = 'user') {
  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'web-e2e',
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

export async function loginUser(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Режим авторизации').getByRole('button', { name: 'Вход' }).click()
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.locator('form').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Сессия активна' })).toBeVisible()
}

export async function logoutUser(page: Page) {
  await page.getByRole('button', { name: 'Открыть меню пользователя' }).click()
  await page.getByRole('menuitem', { name: 'Выйти' }).click()
}

export async function promoteUserToAdmin(email: string) {
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

export async function createApprovedManufacturerProfile(email: string, publicName: string) {
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
