import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('bicycle API integration', () => {
  const env: AppEnv = {
    PORT: 43180,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:43181'],
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

  test('lets only approved manufacturers create, update, and submit their own bicycles', async () => {
    const manufacturer = await createManufacturer('bike-maker@example.com')
    const otherManufacturer = await createManufacturer('other-bike-maker@example.com')

    const createBeforeApproval = await app.request('/api/manufacturer/bicycles', {
      method: 'POST',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Draft Tiny Performer')),
    })
    expect(createBeforeApproval.status).toBe(409)

    const profile = await approveManufacturerProfile(manufacturer.user.id, 'Bike Maker')
    await approveManufacturerProfile(otherManufacturer.user.id, 'Other Bike Maker')

    const roleEscalationPayload = await app.request('/api/manufacturer/bicycles', {
      method: 'POST',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify({
        ...bicyclePayload('Unsafe Payload Bike'),
        status: 'available',
      }),
    })
    expect(roleEscalationPayload.status).toBe(400)

    const create = await app.request('/api/manufacturer/bicycles', {
      method: 'POST',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Draft Tiny Performer')),
    })
    const createBody = await create.json()
    expect(create.status).toBe(200)
    expect(createBody.bicycle.status).toBe('draft')
    expect(createBody.bicycle.manufacturerProfileId).toBe(profile.id)

    const listOwn = await app.request('/api/manufacturer/bicycles', {
      headers: authHeaders(manufacturer.accessToken),
    })
    const listOwnBody = await listOwn.json()
    expect(listOwn.status).toBe(200)
    expect(listOwnBody.items.map((bike: { id: string }) => bike.id)).toEqual([
      createBody.bicycle.id,
    ])

    const listOther = await app.request('/api/manufacturer/bicycles', {
      headers: authHeaders(otherManufacturer.accessToken),
    })
    const listOtherBody = await listOther.json()
    expect(listOther.status).toBe(200)
    expect(listOtherBody.items).toHaveLength(0)

    const updateOther = await app.request(`/api/manufacturer/bicycles/${createBody.bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(otherManufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Other Update Attempt')),
    })
    expect(updateOther.status).toBe(404)

    const update = await app.request(`/api/manufacturer/bicycles/${createBody.bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Updated Tiny Performer')),
    })
    const updateBody = await update.json()
    expect(update.status).toBe(200)
    expect(updateBody.bicycle.title).toBe('Updated Tiny Performer')
    expect(updateBody.bicycle.status).toBe('draft')

    const submit = await app.request(`/api/manufacturer/bicycles/${createBody.bicycle.id}/submit`, {
      method: 'POST',
      headers: authHeaders(manufacturer.accessToken),
    })
    const submitBody = await submit.json()
    expect(submit.status).toBe(200)
    expect(submitBody.bicycle.status).toBe('moderation')
    expect(submitBody.bicycle.submittedAt).toBeString()

    const submitAgain = await app.request(
      `/api/manufacturer/bicycles/${createBody.bicycle.id}/submit`,
      {
        method: 'POST',
        headers: authHeaders(manufacturer.accessToken),
      },
    )
    expect(submitAgain.status).toBe(409)
  })

  test('moderates bicycles and exposes only available bicycles in the public catalog', async () => {
    const admin = await createAdmin('bike-admin@example.com')
    const manufacturer = await createManufacturer('catalog-maker@example.com')
    const profile = await approveManufacturerProfile(manufacturer.user.id, 'Catalog Maker')

    const smallBike = await createAndSubmitBicycle(manufacturer.accessToken, 'Small Catalog Bike', {
      size: 'S',
      pricePerDayKopecks: 200000,
    })
    const mediumBike = await createAndSubmitBicycle(manufacturer.accessToken, 'Medium Catalog Bike', {
      size: 'M',
      pricePerDayKopecks: 350000,
    })

    const approveDraft = await app.request(`/api/admin/bicycles/${smallBike.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'approved' }),
    })
    expect(approveDraft.status).toBe(200)

    const rejectWithoutComment = await app.request(`/api/admin/bicycles/${mediumBike.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'rejected' }),
    })
    expect(rejectWithoutComment.status).toBe(400)

    const reject = await app.request(`/api/admin/bicycles/${mediumBike.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({
        decision: 'rejected',
        moderationComment: 'Add clearer safety photos.',
      }),
    })
    const rejectBody = await reject.json()
    expect(reject.status).toBe(200)
    expect(rejectBody.bicycle.status).toBe('rejected')

    const publicList = await app.request(
      '/api/bicycles?sizes=S,M&maxPriceKopecks=250000&startsOn=2026-05-20&endsOn=2026-05-21&pageSize=10',
    )
    const publicListBody = await publicList.json()
    expect(publicList.status).toBe(200)
    expect(publicListBody.items.map((bike: { title: string }) => bike.title)).toEqual([
      'Small Catalog Bike',
    ])
    expect(publicListBody.items[0].manufacturer.publicName).toBe('Catalog Maker')
    expect(publicListBody.items[0].manufacturerProfileId).toBeUndefined()
    expect(publicListBody.items[0].moderationComment).toBeUndefined()
    expect(publicListBody.items[0].submittedAt).toBeUndefined()
    expect(publicListBody.items[0].reviewedAt).toBeUndefined()

    const customer = await registerUser('catalog-renter@example.com')
    await createConfirmedOrderForBicycle(customer.user.id, smallBike.id, '2026-05-20', '2026-05-21')

    const conflictingDateList = await app.request(
      '/api/bicycles?startsOn=2026-05-19&endsOn=2026-05-20&pageSize=10',
    )
    const conflictingDateListBody = await conflictingDateList.json()
    expect(conflictingDateList.status).toBe(200)
    expect(conflictingDateListBody.items).toHaveLength(0)

    const adjacentDateList = await app.request(
      '/api/bicycles?startsOn=2026-05-22&endsOn=2026-05-23&pageSize=10',
    )
    const adjacentDateListBody = await adjacentDateList.json()
    expect(adjacentDateList.status).toBe(200)
    expect(adjacentDateListBody.items.map((bike: { title: string }) => bike.title)).toEqual([
      'Small Catalog Bike',
    ])

    const publicDetail = await app.request(`/api/bicycles/${smallBike.id}`)
    const publicDetailBody = await publicDetail.json()
    expect(publicDetail.status).toBe(200)
    expect(publicDetailBody.bicycle.title).toBe('Small Catalog Bike')
    expect(publicDetailBody.bicycle.depositKopecks).toBe(500000)
    expect(publicDetailBody.bicycle.manufacturerProfileId).toBeUndefined()
    expect(publicDetailBody.bicycle.submittedAt).toBeUndefined()
    expect(publicDetailBody.bicycle.reviewedAt).toBeUndefined()

    const adminList = await app.request('/api/admin/bicycles?status=available&pageSize=10', {
      headers: authHeaders(admin.accessToken),
    })
    const adminListBody = await adminList.json()
    expect(adminList.status).toBe(200)
    expect(adminListBody.items[0].manufacturer.status).toBe('approved')

    const rejectedDetail = await app.request(`/api/bicycles/${mediumBike.id}`)
    expect(rejectedDetail.status).toBe(404)

    const invalidDates = await app.request('/api/bicycles?startsOn=2026-05-20')
    expect(invalidDates.status).toBe(400)

    await prisma.manufacturerProfile.update({
      where: { id: profile.id },
      data: {
        status: 'blocked',
        moderationComment: 'Safety incident.',
      },
    })

    const listAfterManufacturerBlock = await app.request('/api/bicycles?pageSize=10')
    const listAfterManufacturerBlockBody = await listAfterManufacturerBlock.json()
    expect(listAfterManufacturerBlock.status).toBe(200)
    expect(listAfterManufacturerBlockBody.items).toHaveLength(0)

    const detailAfterManufacturerBlock = await app.request(`/api/bicycles/${smallBike.id}`)
    expect(detailAfterManufacturerBlock.status).toBe(404)
  })

  test('editing an available bicycle by its manufacturer removes it from the public catalog', async () => {
    const admin = await createAdmin('edit-admin@example.com')
    const manufacturer = await createManufacturer('edit-maker@example.com')
    await approveManufacturerProfile(manufacturer.user.id, 'Edit Maker')

    const bicycle = await createAndSubmitBicycle(manufacturer.accessToken, 'Public Bike')
    await app.request(`/api/admin/bicycles/${bicycle.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'approved' }),
    })

    const publicBeforeEdit = await app.request(`/api/bicycles/${bicycle.id}`)
    expect(publicBeforeEdit.status).toBe(200)

    const update = await app.request(`/api/manufacturer/bicycles/${bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Edited Bike')),
    })
    const updateBody = await update.json()
    expect(update.status).toBe(200)
    expect(updateBody.bicycle.status).toBe('draft')

    const publicAfterEdit = await app.request(`/api/bicycles/${bicycle.id}`)
    expect(publicAfterEdit.status).toBe(404)
  })

  test('lets admins hide, maintain, restore, and archive public bicycles', async () => {
    const admin = await createAdmin('status-admin@example.com')
    const manufacturer = await createManufacturer('status-maker@example.com')
    await approveManufacturerProfile(manufacturer.user.id, 'Status Maker')

    const bicycle = await createAndSubmitBicycle(manufacturer.accessToken, 'Status Bike')
    const statusFromModeration = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'available' }),
    })
    expect(statusFromModeration.status).toBe(409)

    await app.request(`/api/admin/bicycles/${bicycle.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'approved' }),
    })

    const hide = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'hidden' }),
    })
    const hideBody = await hide.json()
    expect(hide.status).toBe(200)
    expect(hideBody.bicycle.status).toBe('hidden')

    await prisma.manufacturerProfile.update({
      where: { userId: manufacturer.user.id },
      data: {
        status: 'blocked',
        moderationComment: 'Safety incident.',
      },
    })

    const restoreBlockedManufacturer = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'available' }),
    })
    expect(restoreBlockedManufacturer.status).toBe(409)

    await prisma.manufacturerProfile.update({
      where: { userId: manufacturer.user.id },
      data: {
        status: 'approved',
        moderationComment: null,
      },
    })

    const producerUpdateHidden = await app.request(`/api/manufacturer/bicycles/${bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Hidden Update')),
    })
    expect(producerUpdateHidden.status).toBe(409)

    const restore = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'available' }),
    })
    expect(restore.status).toBe(200)

    const maintenance = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'maintenance' }),
    })
    const maintenanceBody = await maintenance.json()
    expect(maintenance.status).toBe(200)
    expect(maintenanceBody.bicycle.status).toBe('maintenance')

    const producerUpdateMaintenance = await app.request(`/api/manufacturer/bicycles/${bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Maintenance Update')),
    })
    expect(producerUpdateMaintenance.status).toBe(409)

    const archive = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'archived' }),
    })
    expect(archive.status).toBe(200)

    const restoreArchived = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'available' }),
    })
    expect(restoreArchived.status).toBe(409)

    const producerUpdateArchived = await app.request(`/api/manufacturer/bicycles/${bicycle.id}`, {
      method: 'PATCH',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Archived Update')),
    })
    expect(producerUpdateArchived.status).toBe(409)
  })

  test('blocks manual admin status changes for bicycles in issued orders', async () => {
    const admin = await createAdmin('rented-status-admin@example.com')
    const manufacturer = await createManufacturer('rented-status-maker@example.com')
    await approveManufacturerProfile(manufacturer.user.id, 'Rented Status Maker')
    const renter = await registerUser('rented-status-owner@example.com', 'Owner')

    const bicycle = await createAndSubmitBicycle(manufacturer.accessToken, 'Rented Status Bike')
    const approve = await app.request(`/api/admin/bicycles/${bicycle.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'approved' }),
    })
    expect(approve.status).toBe(200)
    await createIssuedOrderForBicycle(renter.user.id, bicycle.id)

    const manualMaintenance = await app.request(`/api/admin/bicycles/${bicycle.id}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ status: 'maintenance' }),
    })
    const manualMaintenanceBody = await manualMaintenance.json()

    expect(manualMaintenance.status).toBe(409)
    expect(manualMaintenanceBody.error.code).toBe('CONFLICT')
    expect((await prisma.bicycle.findUniqueOrThrow({ where: { id: bicycle.id } })).status).toBe('rented')
    expect(await prisma.order.count({
      where: {
        status: 'issued',
        items: { some: { bicycleId: bicycle.id } },
      },
    })).toBe(1)
  })

  test('does not publish bicycles for manufacturers that lose approval', async () => {
    const admin = await createAdmin('blocked-admin@example.com')
    const manufacturer = await createManufacturer('blocked-catalog-maker@example.com')
    await approveManufacturerProfile(manufacturer.user.id, 'Blocked Catalog Maker')

    const bicycle = await createAndSubmitBicycle(manufacturer.accessToken, 'Blocked Manufacturer Bike')

    await prisma.manufacturerProfile.update({
      where: { userId: manufacturer.user.id },
      data: {
        status: 'blocked',
        moderationComment: 'Safety incident.',
      },
    })

    const approve = await app.request(`/api/admin/bicycles/${bicycle.id}/moderation`, {
      method: 'PATCH',
      headers: authJsonHeaders(admin.accessToken),
      body: JSON.stringify({ decision: 'approved' }),
    })
    expect(approve.status).toBe(409)
  })

  test('does not create a bicycle if the manufacturer loses approval during creation', async () => {
    const manufacturer = await createManufacturer('create-race-maker@example.com')
    const profile = await approveManufacturerProfile(manufacturer.user.id, 'Create Race Maker')
    const lockClient = createPrisma(databaseUrl!)
    let createWhileBlocking: Promise<Response> | null = null

    try {
      await lockClient.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "manufacturer_profiles"
          WHERE "id" = ${profile.id}
          FOR UPDATE
        `

        createWhileBlocking = Promise.resolve(app.request('/api/manufacturer/bicycles', {
          method: 'POST',
          headers: authJsonHeaders(manufacturer.accessToken),
          body: JSON.stringify(bicyclePayload('Race Draft Bike')),
        }))

        await new Promise((resolve) => setTimeout(resolve, 50))
        await tx.manufacturerProfile.update({
          where: { id: profile.id },
          data: {
            status: 'blocked',
            moderationComment: 'Blocked during creation.',
          },
        })
      })
    } finally {
      await lockClient.$disconnect()
    }

    expect(createWhileBlocking).not.toBeNull()
    const create = await createWhileBlocking!
    expect(create.status).toBe(409)
    const bicycleCount = await prisma.bicycle.count({
      where: { manufacturerProfileId: profile.id },
    })
    expect(bicycleCount).toBe(0)
  })

  test('blocks bicycle management when manufacturer profile is blocked', async () => {
    const manufacturer = await createManufacturer('blocked-bike-maker@example.com')
    await prisma.manufacturerProfile.create({
      data: {
        userId: manufacturer.user.id,
        legalName: 'Blocked Bike Maker LLC',
        publicName: 'Blocked Bike Maker',
        city: 'Moscow',
        phone: '+7 999 000-00-00',
        email: 'blocked-bike-maker@example.com',
        description: 'Blocked manufacturer profile.',
        status: 'blocked',
        moderationComment: 'Safety issue.',
      },
    })

    const create = await app.request('/api/manufacturer/bicycles', {
      method: 'POST',
      headers: authJsonHeaders(manufacturer.accessToken),
      body: JSON.stringify(bicyclePayload('Blocked Bike')),
    })
    const createBody = await create.json()
    expect(create.status).toBe(409)
    expect(createBody.error.code).toBe('CONFLICT')
  })

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

  async function approveManufacturerProfile(userId: string, publicName: string) {
    return prisma.manufacturerProfile.create({
      data: {
        userId,
        legalName: `${publicName} LLC`,
        publicName,
        region: 'Moscow',
        city: 'Moscow',
        phone: '+7 999 000-00-00',
        email: `${publicName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.com`,
        description: 'Approved manufacturer profile.',
        status: 'approved',
        reviewedAt: new Date(),
      },
    })
  }

  async function createAndSubmitBicycle(
    accessToken: string,
    title: string,
    overrides: Partial<ReturnType<typeof bicyclePayload>> = {},
  ) {
    const create = await app.request('/api/manufacturer/bicycles', {
      method: 'POST',
      headers: authJsonHeaders(accessToken),
      body: JSON.stringify({
        ...bicyclePayload(title),
        ...overrides,
      }),
    })
    const createBody = await create.json()
    expect(create.status).toBe(200)

    const submit = await app.request(`/api/manufacturer/bicycles/${createBody.bicycle.id}/submit`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
    const submitBody = await submit.json()
    expect(submit.status).toBe(200)
    return submitBody.bicycle
  }

  async function createConfirmedOrderForBicycle(
    userId: string,
    bicycleId: string,
    startsOn: string,
    endsOn: string,
  ) {
    const bicycle = await prisma.bicycle.findUniqueOrThrow({
      where: { id: bicycleId },
      include: { manufacturerProfile: true },
    })

    return prisma.order.create({
      data: {
        userId,
        status: 'confirmed',
        startsOn,
        endsOn,
        rentalDays: 2,
        fulfillmentType: 'pickup',
        deliveryAddress: null,
        contactName: 'Trainer',
        contactPhone: '+7 999 111-22-33',
        userComment: null,
        adminComment: 'Confirmed catalog availability fixture.',
        rentalAmountKopecks: bicycle.pricePerDayKopecks * 2,
        depositAmountKopecks: bicycle.depositKopecks,
        deliveryAmountKopecks: 0,
        totalAmountKopecks: bicycle.pricePerDayKopecks * 2 + bicycle.depositKopecks,
        safetyAgreementAcceptedAt: new Date(),
        items: {
          create: {
            bicycleId: bicycle.id,
            pricePerDaySnapshotKopecks: bicycle.pricePerDayKopecks,
            depositSnapshotKopecks: bicycle.depositKopecks,
            bicycleTitleSnapshot: bicycle.title,
            bicycleSizeSnapshot: bicycle.size,
            bicycleCitySnapshot: bicycle.city,
            bicyclePickupAddressSnapshot: bicycle.pickupAddress,
            bicycleDeliveryAvailableSnapshot: bicycle.deliveryAvailable,
            manufacturerProfileIdSnapshot: bicycle.manufacturerProfile.id,
            manufacturerPublicNameSnapshot: bicycle.manufacturerProfile.publicName,
            manufacturerRegionSnapshot: bicycle.manufacturerProfile.region,
            manufacturerCitySnapshot: bicycle.manufacturerProfile.city,
          },
        },
      },
    })
  }

  async function createIssuedOrderForBicycle(userId: string, bicycleId: string) {
    const bicycle = await prisma.bicycle.findUniqueOrThrow({
      where: { id: bicycleId },
      include: { manufacturerProfile: true },
    })

    await prisma.$transaction([
      prisma.order.create({
        data: {
          userId,
          status: 'issued',
          startsOn: '2026-05-12',
          endsOn: '2026-05-12',
          rentalDays: 1,
          fulfillmentType: 'pickup',
          deliveryAddress: null,
          contactName: 'Trainer',
          contactPhone: '+7 999 111-22-33',
          userComment: null,
          adminComment: null,
          rentalAmountKopecks: bicycle.pricePerDayKopecks,
          depositAmountKopecks: bicycle.depositKopecks,
          deliveryAmountKopecks: 0,
          totalAmountKopecks: bicycle.pricePerDayKopecks + bicycle.depositKopecks,
          safetyAgreementAcceptedAt: new Date(),
          items: {
            create: {
              bicycleId: bicycle.id,
              pricePerDaySnapshotKopecks: bicycle.pricePerDayKopecks,
              depositSnapshotKopecks: bicycle.depositKopecks,
              bicycleTitleSnapshot: bicycle.title,
              bicycleSizeSnapshot: bicycle.size,
              bicycleCitySnapshot: bicycle.city,
              bicyclePickupAddressSnapshot: bicycle.pickupAddress,
              bicycleDeliveryAvailableSnapshot: bicycle.deliveryAvailable,
              manufacturerProfileIdSnapshot: bicycle.manufacturerProfile.id,
              manufacturerPublicNameSnapshot: bicycle.manufacturerProfile.publicName,
              manufacturerRegionSnapshot: bicycle.manufacturerProfile.region,
              manufacturerCitySnapshot: bicycle.manufacturerProfile.city,
            },
          },
        },
      }),
      prisma.bicycle.update({
        where: { id: bicycle.id },
        data: { status: 'rented' },
      }),
    ])
  }
})

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

function authJsonHeaders(accessToken: string) {
  return {
    ...authHeaders(accessToken),
    'Content-Type': 'application/json',
  }
}

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S',
    photoUrls: ['https://example.com/bike.jpg'],
    pricePerDayKopecks: 250000,
    depositKopecks: 500000,
    region: 'Moscow',
    city: 'Moscow',
    pickupAddress: 'Main storage, door 2',
    deliveryAvailable: true,
    maxLoadKg: 12,
    seatHeightCm: 22,
    frameLengthCm: 40,
    wheelDiameterCm: 16,
    recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
    safetyNotes: 'Use only with trained handlers and indoor safety mats.',
  }
}
