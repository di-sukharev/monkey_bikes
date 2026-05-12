import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('auth API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  async function registerUser(
    email: string,
    options: string | { displayName?: string; role?: 'manufacturer' | 'user' } = {},
  ) {
    const displayName = typeof options === 'string' ? options : options.displayName
    const role = typeof options === 'string' ? undefined : options.role
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email,
        password: 'password123',
        ...(displayName === undefined ? {} : { displayName }),
        ...(role === undefined ? {} : { role }),
      }),
    })

    expect(response.status).toBe(201)
    return response.json()
  }

  async function createAdmin(email: string) {
    const body = await registerUser(email, 'Admin')
    await prisma.user.update({
      where: { email },
      data: {
        role: 'admin',
        status: 'active',
      },
    })
    return body
  }

  beforeEach(async () => {
    await prisma.authSession.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('registers, reads me, refreshes, and logs out', async () => {
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123',
        displayName: 'User',
      }),
    })
    const registerBody = await register.json()

    expect(register.status).toBe(201)
    expect(registerBody.user.email).toBe('user@example.com')
    expect(registerBody.user.role).toBe('user')
    expect(registerBody.user.status).toBe('active')
    expect(registerBody.user.updatedAt).toBeString()
    expect(registerBody.accessToken).toBeString()
    expect(registerBody.refreshToken).toBeString()

    const me = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${registerBody.accessToken}`,
      },
    })
    const meBody = await me.json()
    expect(me.status).toBe(200)
    expect(meBody.user.role).toBe('user')
    expect(meBody.user.status).toBe('active')

    const refresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({ refreshToken: registerBody.refreshToken }),
    })
    const refreshBody = await refresh.json()
    expect(refresh.status).toBe(200)
    expect(refreshBody.accessToken).toBeString()
    expect(refreshBody.refreshToken).toBeString()
    expect(refreshBody.refreshToken).not.toBe(registerBody.refreshToken)

    const staleRefresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({ refreshToken: registerBody.refreshToken }),
    })
    expect(staleRefresh.status).toBe(401)

    const logout = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken }),
    })
    expect(logout.status).toBe(204)

    const revokedRefresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken }),
    })
    expect(revokedRefresh.status).toBe(401)
  })

  test('allows only one concurrent refresh rotation for the same token', async () => {
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email: 'race@example.com',
        password: 'password123',
      }),
    })
    const registerBody = await register.json()

    const refreshRequests = await Promise.all([
      app.request('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'mobile',
        },
        body: JSON.stringify({ refreshToken: registerBody.refreshToken }),
      }),
      app.request('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'mobile',
        },
        body: JSON.stringify({ refreshToken: registerBody.refreshToken }),
      }),
    ])

    const statuses = refreshRequests.map((response) => response.status).sort((left, right) => left - right)
    expect(statuses).toEqual([200, 401])

    const activeSessions = await prisma.authSession.count({
      where: {
        user: {
          email: 'race@example.com',
        },
        revokedAt: null,
      },
    })
    expect(activeSessions).toBe(1)
  })

  test('web auth uses an HttpOnly refresh cookie instead of response body refresh token', async () => {
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
      },
      body: JSON.stringify({
        email: 'web-cookie@example.com',
        password: 'password123',
      }),
    })
    const registerBody = await register.json()
    const setCookie = register.headers.get('set-cookie')

    expect(register.status).toBe(201)
    expect(registerBody.refreshToken).toBeUndefined()
    expect(setCookie).toContain('web_app_demo_refresh=')
    expect(setCookie).toContain('HttpOnly')

    const refresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: setCookie!.split(';')[0],
        'X-Client-Platform': 'web',
      },
      body: JSON.stringify({}),
    })
    const refreshBody = await refresh.json()

    expect(refresh.status).toBe(200)
    expect(refreshBody.accessToken).toBeString()
    expect(refreshBody.refreshToken).toBeUndefined()
  })

  test('guards me and returns stable validation errors', async () => {
    const unauthorizedMe = await app.request('/api/auth/me')
    expect(unauthorizedMe.status).toBe(401)

    const invalidRegister = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'short',
      }),
    })
    const body = await invalidRegister.json()

    expect(invalidRegister.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Invalid request payload')
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  test('rejects duplicate email and invalid login', async () => {
    const payload = {
      email: 'dupe@example.com',
      password: 'password123',
    }

    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const duplicate = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(duplicate.status).toBe(409)

    const invalidLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        password: 'wrong-password',
      }),
    })
    expect(invalidLogin.status).toBe(401)
  })

  test('guards admin users API with authentication and admin role', async () => {
    const anonymous = await app.request('/api/admin/users')
    const anonymousBody = await anonymous.json()
    expect(anonymous.status).toBe(401)
    expect(anonymousBody.error.code).toBe('UNAUTHORIZED')

    const user = await registerUser('not-admin@example.com')
    const forbidden = await app.request('/api/admin/users', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    const forbiddenBody = await forbidden.json()
    expect(forbidden.status).toBe(403)
    expect(forbiddenBody.error.code).toBe('FORBIDDEN')
  })

  test('lets admins list, read, and update users with pagination', async () => {
    const admin = await createAdmin('admin@example.com')
    const firstUser = await registerUser('first-user@example.com', 'First User')
    const secondUser = await registerUser('second-user@example.com', 'Second User')

    const patchManufacturer = await app.request(`/api/admin/users/${firstUser.user.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'manufacturer' }),
    })
    const patchManufacturerBody = await patchManufacturer.json()
    expect(patchManufacturer.status).toBe(200)
    expect(patchManufacturerBody.user.role).toBe('manufacturer')

    const list = await app.request('/api/admin/users?page=1&pageSize=2', {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
      },
    })
    const listBody = await list.json()
    expect(list.status).toBe(200)
    expect(listBody.items).toHaveLength(2)
    expect(listBody.total).toBe(3)
    expect(listBody.page).toBe(1)
    expect(listBody.pageSize).toBe(2)

    const filtered = await app.request('/api/admin/users?role=manufacturer&pageSize=10', {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
      },
    })
    const filteredBody = await filtered.json()
    expect(filtered.status).toBe(200)
    expect(filteredBody.items.map((user: { email: string }) => user.email)).toEqual([
      'first-user@example.com',
    ])

    const details = await app.request(`/api/admin/users/${secondUser.user.id}`, {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
      },
    })
    const detailsBody = await details.json()
    expect(details.status).toBe(200)
    expect(detailsBody.user.email).toBe('second-user@example.com')
  })

  test('blocks users, revokes active sessions, and rejects future auth', async () => {
    const admin = await createAdmin('block-admin@example.com')
    const user = await registerUser('blocked-user@example.com')

    const block = await app.request(`/api/admin/users/${user.user.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'blocked' }),
    })
    const blockBody = await block.json()
    expect(block.status).toBe(200)
    expect(blockBody.user.status).toBe('blocked')

    const activeSessions = await prisma.authSession.count({
      where: {
        userId: user.user.id,
        revokedAt: null,
      },
    })
    expect(activeSessions).toBe(0)

    const me = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    expect(me.status).toBe(401)

    const refresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({ refreshToken: user.refreshToken }),
    })
    expect(refresh.status).toBe(401)

    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email: 'blocked-user@example.com',
        password: 'password123',
      }),
    })
    const loginBody = await login.json()
    expect(login.status).toBe(403)
    expect(loginBody.error.code).toBe('FORBIDDEN')
  })

  test('prevents administrators from removing their own active admin access', async () => {
    const admin = await createAdmin('self-admin@example.com')

    const selfBlock = await app.request(`/api/admin/users/${admin.user.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'blocked' }),
    })
    const selfBlockBody = await selfBlock.json()
    expect(selfBlock.status).toBe(409)
    expect(selfBlockBody.error.code).toBe('CONFLICT')

    const selfDemote = await app.request(`/api/admin/users/${admin.user.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'user' }),
    })
    const selfDemoteBody = await selfDemote.json()
    expect(selfDemote.status).toBe(409)
    expect(selfDemoteBody.error.code).toBe('CONFLICT')
  })

  test('preserves one active admin during concurrent cross-block attempts', async () => {
    const firstAdmin = await createAdmin('first-concurrent-admin@example.com')
    const secondAdmin = await createAdmin('second-concurrent-admin@example.com')

    const responses = await Promise.all([
      app.request(`/api/admin/users/${secondAdmin.user.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${firstAdmin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'blocked' }),
      }),
      app.request(`/api/admin/users/${firstAdmin.user.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${secondAdmin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'blocked' }),
      }),
    ])

    const statuses = responses.map((response) => response.status).sort((left, right) => left - right)
    expect(statuses).toEqual([200, 409])

    const activeAdmins = await prisma.user.count({
      where: {
        role: 'admin',
        status: 'active',
      },
    })
    expect(activeAdmins).toBe(1)
  })

  test('returns one created user and one conflict for concurrent duplicate registration', async () => {
    const payload = {
      email: 'register-race@example.com',
      password: 'password123',
    }

    const [first, second] = await Promise.all([
      app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ])

    const statuses = [first.status, second.status].sort((left, right) => left - right)
    expect(statuses).toEqual([201, 409])

    const users = await prisma.user.count({
      where: {
        email: payload.email,
      },
    })
    expect(users).toBe(1)
  })
})
