import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { rentalDaysInclusive } from '@web-app-demo/contracts'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { integrationDatabaseUrl } from '../test/integration-database'

const databaseUrl = integrationDatabaseUrl()

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('admin reports API integration', () => {
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

  beforeEach(async () => {
    await prisma.authSession.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.orderStatusHistory.deleteMany()
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('aggregates period summary, utilization, and manufacturer stats', async () => {
    const admin = await createAdmin('reports-admin@example.com')
    const user = await registerUser('reports-renter@example.com', 'Renter')
    const smallBicycle = await createAvailableBicycle('Report Maker A', {
      title: 'Small Report Bike',
      size: 'S',
      pricePerDayKopecks: 10000,
      depositKopecks: 50000,
    })
    const mediumBicycle = await createAvailableBicycle('Report Maker A', {
      title: 'Medium Report Bike',
      size: 'M',
      pricePerDayKopecks: 20000,
      depositKopecks: 70000,
    })
    const largeBicycle = await createAvailableBicycle('Report Maker B', {
      title: 'Large Report Bike',
      size: 'L',
      pricePerDayKopecks: 30000,
      depositKopecks: 90000,
    })

    const firstOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'confirmed',
      startsOn: '2026-05-10',
      endsOn: '2026-05-12',
      bicycles: [smallBicycle],
    })
    await createPayment(firstOrder.id, 'rent', 'succeeded', 30000, '2026-05-11T10:00:00.000Z')
    await createPayment(firstOrder.id, 'deposit', 'succeeded', 50000, '2026-05-11T10:05:00.000Z')

    const secondOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'issued',
      startsOn: '2026-05-13',
      endsOn: '2026-05-14',
      bicycles: [mediumBicycle],
    })
    await createPayment(secondOrder.id, 'rent', 'pending', 40000, null)
    await createPayment(secondOrder.id, 'deposit', 'failed', 70000, '2026-05-13T10:00:00.000Z')

    const boundaryStartOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'confirmed',
      startsOn: '2026-04-01',
      endsOn: '2026-04-01',
      bicycles: [smallBicycle],
    })
    await createPayment(boundaryStartOrder.id, 'rent', 'succeeded', 1111, '2026-05-11T00:00:00.000Z')

    const boundaryEndOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'confirmed',
      startsOn: '2026-04-02',
      endsOn: '2026-04-02',
      bicycles: [smallBicycle],
    })
    await createPayment(boundaryEndOrder.id, 'rent', 'succeeded', 2222, '2026-05-13T23:59:59.999Z')

    const excludedBeforeOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'confirmed',
      startsOn: '2026-04-03',
      endsOn: '2026-04-03',
      bicycles: [mediumBicycle],
    })
    await createPayment(excludedBeforeOrder.id, 'deposit', 'succeeded', 3333, '2026-05-10T23:59:59.999Z')

    const excludedAfterOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'confirmed',
      startsOn: '2026-04-04',
      endsOn: '2026-04-04',
      bicycles: [mediumBicycle],
    })
    await createPayment(excludedAfterOrder.id, 'deposit', 'succeeded', 4444, '2026-05-14T00:00:00.000Z')

    await createOrderRecord({
      userId: user.user.id,
      status: 'returned',
      startsOn: '2026-05-01',
      endsOn: '2026-05-02',
      bicycles: [largeBicycle],
    })

    const cancelledOrder = await createOrderRecord({
      userId: user.user.id,
      status: 'cancelled',
      startsOn: '2026-05-12',
      endsOn: '2026-05-12',
      bicycles: [largeBicycle],
    })
    await prisma.orderStatusHistory.create({
      data: {
        orderId: cancelledOrder.id,
        fromStatus: 'request',
        toStatus: 'cancelled',
        changedByUserId: admin.user.id,
        comment: 'Customer schedule changed.',
        createdAt: new Date('2026-05-12T12:00:00.000Z'),
      },
    })

    const summary = await app.request('/api/admin/reports/summary?startsOn=2026-05-11&endsOn=2026-05-13', {
      headers: authHeaders(admin.accessToken),
    })
    const summaryBody = await summary.json()
    expect(summary.status).toBe(200)
    expect(summaryBody.period).toEqual({
      startsOn: '2026-05-11',
      endsOn: '2026-05-13',
      days: 3,
    })
    expect(summaryBody.orders).toEqual({
      activeRentalOrderCount: 2,
      activeRentalItemCount: 2,
      cancelledOrderCount: 1,
    })
    expect(summaryBody.successfulPayments).toEqual({
      rent: {
        count: 3,
        amountKopecks: 33333,
      },
      deposit: {
        count: 1,
        amountKopecks: 50000,
      },
    })
    expect(summaryBody.mostRentedSizes).toEqual([
      {
        size: 'S',
        rentalItemCount: 1,
        rentedDays: 2,
      },
      {
        size: 'M',
        rentalItemCount: 1,
        rentedDays: 1,
      },
    ])

    const utilization = await app.request(
      '/api/admin/reports/bicycle-utilization?startsOn=2026-05-11&endsOn=2026-05-13&page=1&pageSize=1',
      {
        headers: authHeaders(admin.accessToken),
      },
    )
    const utilizationBody = await utilization.json()
    expect(utilization.status).toBe(200)
    expect(utilizationBody.total).toBe(2)
    expect(utilizationBody.items).toHaveLength(1)
    expect(utilizationBody.items[0]).toMatchObject({
      bicycleId: smallBicycle.id,
      title: 'Small Report Bike',
      size: 'S',
      rentalItemCount: 1,
      rentedDays: 2,
      rentalAmountKopecks: 20000,
      manufacturer: {
        publicName: 'Report Maker A',
      },
    })
    expect(utilizationBody.items[0].utilizationRate).toBeCloseTo(2 / 3)

    const manufacturers = await app.request(
      '/api/admin/reports/manufacturers?startsOn=2026-05-11&endsOn=2026-05-13&pageSize=10',
      {
        headers: authHeaders(admin.accessToken),
      },
    )
    const manufacturersBody = await manufacturers.json()
    expect(manufacturers.status).toBe(200)
    expect(manufacturersBody.total).toBe(2)
    expect(manufacturersBody.items[0]).toMatchObject({
      manufacturer: {
        publicName: 'Report Maker A',
      },
      activeRentalOrderCount: 2,
      bicycleCount: 2,
      rentalItemCount: 2,
      rentedDays: 3,
      rentalAmountKopecks: 40000,
      depositAmountKopecks: 120000,
      cancelledOrderCount: 0,
    })
    expect(manufacturersBody.items[1]).toMatchObject({
      manufacturer: {
        publicName: 'Report Maker B',
      },
      activeRentalOrderCount: 0,
      bicycleCount: 0,
      rentalItemCount: 0,
      rentedDays: 0,
      rentalAmountKopecks: 0,
      depositAmountKopecks: 0,
      cancelledOrderCount: 1,
    })
  })

  test('returns empty report states and guards admin-only routes', async () => {
    const admin = await createAdmin('empty-reports-admin@example.com')
    const user = await registerUser('empty-reports-renter@example.com', 'Renter')

    const summary = await app.request('/api/admin/reports/summary?startsOn=2026-06-01&endsOn=2026-06-30', {
      headers: authHeaders(admin.accessToken),
    })
    const summaryBody = await summary.json()
    expect(summary.status).toBe(200)
    expect(summaryBody.orders).toEqual({
      activeRentalOrderCount: 0,
      activeRentalItemCount: 0,
      cancelledOrderCount: 0,
    })
    expect(summaryBody.successfulPayments.rent.amountKopecks).toBe(0)
    expect(summaryBody.mostRentedSizes).toEqual([])

    const utilization = await app.request(
      '/api/admin/reports/bicycle-utilization?startsOn=2026-06-01&endsOn=2026-06-30&pageSize=10',
      {
        headers: authHeaders(admin.accessToken),
      },
    )
    const utilizationBody = await utilization.json()
    expect(utilization.status).toBe(200)
    expect(utilizationBody.items).toEqual([])
    expect(utilizationBody.total).toBe(0)

    const invalidPeriod = await app.request('/api/admin/reports/summary?startsOn=2026-06-30&endsOn=2026-06-01', {
      headers: authHeaders(admin.accessToken),
    })
    expect(invalidPeriod.status).toBe(400)

    const nonAdmin = await app.request('/api/admin/reports/summary?startsOn=2026-06-01&endsOn=2026-06-30', {
      headers: authHeaders(user.accessToken),
    })
    expect(nonAdmin.status).toBe(403)
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

  async function createAvailableBicycle(
    publicName: string,
    overrides: Partial<ReturnType<typeof bicyclePayload>> = {},
  ) {
    const profile = await approvedManufacturerProfile(publicName)

    return prisma.bicycle.create({
      data: {
        ...bicyclePayload('Tiny Report Bike'),
        ...overrides,
        manufacturerProfileId: profile.id,
        status: 'available',
        reviewedAt: new Date(),
      },
      include: {
        manufacturerProfile: true,
      },
    })
  }

  async function createOrderRecord({
    bicycles,
    endsOn,
    startsOn,
    status,
    userId,
  }: {
    bicycles: Awaited<ReturnType<typeof createAvailableBicycle>>[]
    endsOn: string
    startsOn: string
    status: 'cancelled' | 'confirmed' | 'issued' | 'request' | 'returned'
    userId: string
  }) {
    const rentalDays = rentalDaysInclusive(startsOn, endsOn)
    const rentalAmountKopecks = bicycles.reduce(
      (total, bicycle) => total + bicycle.pricePerDayKopecks * rentalDays,
      0,
    )
    const depositAmountKopecks = bicycles.reduce(
      (total, bicycle) => total + bicycle.depositKopecks,
      0,
    )

    return prisma.order.create({
      data: {
        userId,
        status,
        startsOn,
        endsOn,
        rentalDays,
        fulfillmentType: 'pickup',
        deliveryAddress: null,
        contactName: 'Trainer',
        contactPhone: '+7 999 111-22-33',
        userComment: null,
        rentalAmountKopecks,
        depositAmountKopecks,
        deliveryAmountKopecks: 0,
        totalAmountKopecks: rentalAmountKopecks + depositAmountKopecks,
        safetyAgreementAcceptedAt: new Date('2026-05-01T00:00:00.000Z'),
        items: {
          create: bicycles.map((bicycle) => ({
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
          })),
        },
      },
    })
  }

  function createPayment(
    orderId: string,
    type: 'deposit' | 'rent',
    status: 'cancelled' | 'failed' | 'pending' | 'succeeded',
    amountKopecks: number,
    completedAt: string | null,
  ) {
    return prisma.payment.create({
      data: {
        orderId,
        type,
        provider: 'stub',
        status,
        amountKopecks,
        currency: 'RUB',
        providerPaymentId: `stub_${randomUUID()}`,
        failureReason: status === 'failed' ? 'Stub payment failed' : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        activeKey: status === 'pending' || status === 'succeeded' ? 'active' : null,
      },
    })
  }

  async function approvedManufacturerProfile(publicName: string) {
    const existingProfile = await prisma.manufacturerProfile.findFirst({
      where: { publicName },
    })
    if (existingProfile) return existingProfile

    const manufacturerUser = await prisma.user.create({
      data: {
        email: `${publicName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID()}@example.com`,
        passwordHash: 'test-hash',
        displayName: publicName,
        role: 'manufacturer',
        status: 'active',
      },
    })

    return prisma.manufacturerProfile.create({
      data: {
        userId: manufacturerUser.id,
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
})

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S' as 'S' | 'M' | 'L',
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
