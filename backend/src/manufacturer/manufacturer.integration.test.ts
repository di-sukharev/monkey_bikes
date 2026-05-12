import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('manufacturer profile API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    APP_ENV: 'test',
    PAYMENT_PROVIDER: 'stub',
    PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: true,
    PAYMENT_CURRENCY: 'RUB',
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

  async function createManufacturer(email: string) {
    return registerUser(email, {
      displayName: 'Manufacturer',
      role: 'manufacturer',
    })
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
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('lets manufacturers manage and submit only their own profile', async () => {
    const anonymous = await app.request('/api/manufacturer/profile')
    const anonymousBody = await anonymous.json()
    expect(anonymous.status).toBe(401)
    expect(anonymousBody.error.code).toBe('UNAUTHORIZED')

    const user = await registerUser('customer@example.com')
    const forbidden = await app.request('/api/manufacturer/profile', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    const forbiddenBody = await forbidden.json()
    expect(forbidden.status).toBe(403)
    expect(forbiddenBody.error.code).toBe('FORBIDDEN')

    const manufacturer = await createManufacturer('maker@example.com')
    const emptyProfile = await app.request('/api/manufacturer/profile', {
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
      },
    })
    const emptyProfileBody = await emptyProfile.json()
    expect(emptyProfile.status).toBe(200)
    expect(emptyProfileBody.profile).toBeNull()

    const createProfile = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...manufacturerProfilePayload('Tiny Bikes'),
        status: 'approved',
      }),
    })
    const createProfileBody = await createProfile.json()
    expect(createProfile.status).toBe(200)
    expect(createProfileBody.profile.status).toBe('draft')
    expect(createProfileBody.profile.publicName).toBe('Tiny Bikes')

    const submitProfile = await app.request('/api/manufacturer/profile/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
      },
    })
    const submitProfileBody = await submitProfile.json()
    expect(submitProfile.status).toBe(200)
    expect(submitProfileBody.profile.id).toBe(createProfileBody.profile.id)
    expect(submitProfileBody.profile.status).toBe('moderation')
    expect(submitProfileBody.profile.submittedAt).toBeString()

    const otherManufacturer = await createManufacturer('other-maker@example.com')
    const otherProfile = await app.request('/api/manufacturer/profile', {
      headers: {
        Authorization: `Bearer ${otherManufacturer.accessToken}`,
      },
    })
    const otherProfileBody = await otherProfile.json()
    expect(otherProfile.status).toBe(200)
    expect(otherProfileBody.profile).toBeNull()

    const editDuringModeration = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload('Tiny Bikes Updated')),
    })
    const editDuringModerationBody = await editDuringModeration.json()
    expect(editDuringModeration.status).toBe(200)
    expect(editDuringModerationBody.profile.id).toBe(createProfileBody.profile.id)
    expect(editDuringModerationBody.profile.status).toBe('draft')
    expect(editDuringModerationBody.profile.submittedAt).toBeNull()
  })

  test('lets admins list and moderate submitted manufacturer profiles', async () => {
    const admin = await createAdmin('manufacturer-admin@example.com')
    const manufacturer = await createManufacturer('moderated-maker@example.com')
    const user = await registerUser('manufacturer-user@example.com')

    await saveAndSubmitProfile(manufacturer.accessToken, 'Moderated Maker')

    const forbidden = await app.request('/api/admin/manufacturers', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    expect(forbidden.status).toBe(403)

    const list = await app.request('/api/admin/manufacturers?status=moderation&pageSize=10', {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
      },
    })
    const listBody = await list.json()
    expect(list.status).toBe(200)
    expect(listBody.items).toHaveLength(1)
    expect(listBody.items[0].user.email).toBe('moderated-maker@example.com')

    const rejectWithoutComment = await app.request(
      `/api/admin/manufacturers/${listBody.items[0].id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      },
    )
    expect(rejectWithoutComment.status).toBe(400)

    const missingProfile = await app.request('/api/admin/manufacturers/missing-profile/status', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'approved' }),
    })
    const missingProfileBody = await missingProfile.json()
    expect(missingProfile.status).toBe(404)
    expect(missingProfileBody.error.code).toBe('NOT_FOUND')

    const reject = await app.request(`/api/admin/manufacturers/${listBody.items[0].id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'rejected',
        moderationComment: 'Add registration documents before approval.',
      }),
    })
    const rejectBody = await reject.json()
    expect(reject.status).toBe(200)
    expect(rejectBody.profile.status).toBe('rejected')
    expect(rejectBody.profile.moderationComment).toBe('Add registration documents before approval.')
    expect(rejectBody.profile.reviewedAt).toBeString()

    const rejectedList = await app.request('/api/admin/manufacturers?status=rejected&pageSize=10', {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
      },
    })
    const rejectedListBody = await rejectedList.json()
    expect(rejectedList.status).toBe(200)
    expect(rejectedListBody.items.map((profile: { id: string }) => profile.id)).toEqual([
      listBody.items[0].id,
    ])
  })

  test('only approves or rejects profiles that are waiting for moderation', async () => {
    const admin = await createAdmin('state-admin@example.com')
    const manufacturer = await createManufacturer('state-maker@example.com')

    const draft = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload('State Maker')),
    })
    const draftBody = await draft.json()
    expect(draft.status).toBe(200)

    const approveDraft = await app.request(`/api/admin/manufacturers/${draftBody.profile.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(approveDraft.status).toBe(409)

    await app.request('/api/manufacturer/profile/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
      },
    })

    const approveSubmitted = await app.request(
      `/api/admin/manufacturers/${draftBody.profile.id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved' }),
      },
    )
    const approveSubmittedBody = await approveSubmitted.json()
    expect(approveSubmitted.status).toBe(200)
    expect(approveSubmittedBody.profile.status).toBe('approved')

    const submitApproved = await app.request('/api/manufacturer/profile/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
      },
    })
    const submitApprovedBody = await submitApproved.json()
    expect(submitApproved.status).toBe(409)
    expect(submitApprovedBody.error.code).toBe('CONFLICT')

    const rejectApproved = await app.request(
      `/api/admin/manufacturers/${draftBody.profile.id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          moderationComment: 'Needs another review.',
        }),
      },
    )
    expect(rejectApproved.status).toBe(409)
  })

  test('blocks manufacturer profile actions after admin blocks the profile', async () => {
    const admin = await createAdmin('block-manufacturer-admin@example.com')
    const manufacturer = await createManufacturer('blocked-maker@example.com')

    const created = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload('Blocked Maker')),
    })
    const createdBody = await created.json()

    const block = await app.request(`/api/admin/manufacturers/${createdBody.profile.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'blocked',
        moderationComment: 'Safety review required.',
      }),
    })
    expect(block.status).toBe(200)

    const updateBlocked = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload('Blocked Maker Updated')),
    })
    const updateBlockedBody = await updateBlocked.json()
    expect(updateBlocked.status).toBe(409)
    expect(updateBlockedBody.error.code).toBe('CONFLICT')

    const submitBlocked = await app.request('/api/manufacturer/profile/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
      },
    })
    const submitBlockedBody = await submitBlocked.json()
    expect(submitBlocked.status).toBe(409)
    expect(submitBlockedBody.error.code).toBe('CONFLICT')
  })

  test('does not let concurrent manufacturer edits overwrite an admin block', async () => {
    const admin = await createAdmin('race-admin@example.com')
    const manufacturer = await createManufacturer('race-maker@example.com')

    const created = await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${manufacturer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload('Race Maker')),
    })
    const createdBody = await created.json()

    const [block, update] = await Promise.all([
      app.request(`/api/admin/manufacturers/${createdBody.profile.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'blocked',
          moderationComment: 'Concurrent safety block.',
        }),
      }),
      app.request('/api/manufacturer/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${manufacturer.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(manufacturerProfilePayload('Race Maker Updated')),
      }),
    ])

    expect(block.status).toBe(200)
    expect([200, 409]).toContain(update.status)

    const profile = await prisma.manufacturerProfile.findUniqueOrThrow({
      where: { id: createdBody.profile.id },
    })
    expect(profile.status).toBe('blocked')
  })

  async function saveAndSubmitProfile(accessToken: string, publicName: string) {
    await app.request('/api/manufacturer/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerProfilePayload(publicName)),
    })

    await app.request('/api/manufacturer/profile/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }
})

function manufacturerProfilePayload(publicName: string) {
  const slug = publicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return {
    legalName: `${publicName} LLC`,
    publicName,
    region: 'Moscow',
    city: 'Moscow',
    phone: '+7 999 000-00-00',
    email: `${slug}@example.com`,
    description: 'Small bicycles for rehearsals and performances.',
  }
}
