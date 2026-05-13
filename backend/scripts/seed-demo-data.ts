import 'dotenv/config'

import { z } from 'zod'

import { passwordSchema } from '@web-app-demo/contracts'
import { createPrisma } from '../src/db'
import { hashPassword } from '../src/auth/passwords'
import type { DbClient } from '../src/db'

const passwordSuffixes = {
  admin: 'admin',
  manufacturer: 'manufacturer',
  customer: 'customer',
} as const

type DemoUserRole = keyof typeof passwordSuffixes
const bicycleFixtures = [
  {
    title: 'Ridge Trail 500',
    description:
      'Легкий дачный байк для коротких маршрутов с алюминиевым рамообразом и просторной посадкой.',
    size: 'M' as const,
    photoUrls: ['https://images.unsplash.com/photo-1558618666-1b2ef6d1d4c1'],
    pricePerDayKopecks: 1_500,
    depositKopecks: 7_000,
    status: 'available' as const,
    region: 'Воронеж',
    city: 'Воронеж',
    pickupAddress: 'ул. Плотников 11',
    deliveryAvailable: true,
    maxLoadKg: 120,
    seatHeightCm: 74,
    frameLengthCm: 54,
    wheelDiameterCm: 26,
    recommendedAnimalDimensions: '185x70',
    safetyNotes:
      'Перед поездкой проверьте тормозные колодки и тормозные тросы, убедитесь в отсутствии люфта в руле.',
  },
  {
    title: 'City Rider 300',
    description:
      'Городской комфортный велосипед с удобной посадкой для ежедневных поездок и коротких выездов.',
    size: 'L' as const,
    photoUrls: ['https://images.unsplash.com/photo-1517466787929-bc25f4d7a7a8'],
    pricePerDayKopecks: 1_000,
    depositKopecks: 5_000,
    status: 'available' as const,
    region: 'Воронеж',
    city: 'Воронеж',
    pickupAddress: 'ул. Плотников 13',
    deliveryAvailable: false,
    maxLoadKg: 100,
    seatHeightCm: 76,
    frameLengthCm: 56,
    wheelDiameterCm: 28,
    recommendedAnimalDimensions: '180x65',
    safetyNotes: 'Визуальный осмотр цепи и проверка затяжки креплений перед выдачей.',
  },
  {
    title: 'Mountain Bolt 700',
    description:
      'Жесткий MTB с широкими покрышками и усиленными перьями для покатых холмов и грунта.',
    size: 'S' as const,
    photoUrls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e'],
    pricePerDayKopecks: 2_000,
    depositKopecks: 10_000,
    status: 'maintenance' as const,
    region: 'Москва',
    city: 'Москва',
    pickupAddress: 'ул. Яузовская, 8',
    deliveryAvailable: true,
    maxLoadKg: 130,
    seatHeightCm: 72,
    frameLengthCm: 55,
    wheelDiameterCm: 29,
    recommendedAnimalDimensions: '190x75',
    safetyNotes: 'Проверить давление в шинах и свободный ход амортизаторов.',
  },
  {
    title: 'Commuter Slim 120',
    description:
      'Небольшой складной городской велосипед для плотного городского ритма и короткого хранения.',
    size: 'M' as const,
    photoUrls: ['https://images.unsplash.com/photo-1517673132405-a56a62b18b4b'],
    pricePerDayKopecks: 900,
    depositKopecks: 4_500,
    status: 'draft' as const,
    region: null,
    city: 'Казань',
    pickupAddress: 'ул. Баумана 44',
    deliveryAvailable: false,
    maxLoadKg: 90,
    seatHeightCm: 68,
    frameLengthCm: 52,
    wheelDiameterCm: 24,
    recommendedAnimalDimensions: '175x60',
    safetyNotes: 'После сборки обязательно проверьте стопоры складывания и тормоза.',
  },
  {
    title: 'Tourer Classic 400',
    description:
      'Универсальная модель для дальних прогулок по асфальту и грунтовым дорожкам.',
    size: 'L' as const,
    photoUrls: ['https://images.unsplash.com/photo-1544620347-c4fd4f7c26dd'],
    pricePerDayKopecks: 1_800,
    depositKopecks: 9_000,
    status: 'rejected' as const,
    region: 'Казань',
    city: 'Казань',
    pickupAddress: 'ул. Кремлевская 101',
    deliveryAvailable: true,
    maxLoadKg: 140,
    seatHeightCm: 78,
    frameLengthCm: 57,
    wheelDiameterCm: 28,
    recommendedAnimalDimensions: '188x78',
    safetyNotes:
      'Проверить шлемной комплект и комплектность багажных креплений перед выдачей.',
  },
]

const demoConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SEED_DEMO_PASSWORD: passwordSchema,
  SEED_DEMO_ALLOW_NON_LOCAL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

const env = demoConfigSchema.parse(process.env)

if (isKnownInsecurePassword(env.SEED_DEMO_PASSWORD)) {
  throw new Error('SEED_DEMO_PASSWORD must not be a well-known weak example password')
}

if (!env.SEED_DEMO_ALLOW_NON_LOCAL && !isLocalDatabaseUrl(env.DATABASE_URL)) {
  throw new Error(
    'seed:demo-data can only target a local database unless SEED_DEMO_ALLOW_NON_LOCAL=true',
  )
}

const prisma = createPrisma(env.DATABASE_URL)

try {
  const passwordHashes = await Promise.all(
    Object.entries(passwordSuffixes).map(async ([role, suffix]) => [
      role,
      await hashPassword(deriveDemoPassword(env.SEED_DEMO_PASSWORD, suffix)),
    ]),
  )

  const passwordHashByRole = Object.fromEntries(passwordHashes) as Record<
    DemoUserRole,
    string
  >

  const result = await seedDemoData(prisma, { passwordHashByRole })
  console.log('[seed:demo-data] created demo dataset')
  console.log(`[seed:demo-data] users: ${result.admin.email}, ${result.manufacturer.email}, ${result.customer.email}`)
  console.log(
    `[seed:demo-data] manufacturer profile: ${result.profile.publicName} (${result.profile.region ?? 'без региона'}, ${result.profile.city})`,
  )
  console.log(`[seed:demo-data] bicycles: ${result.bicycleIds.length}, orders: ${result.orderCount}`)
  console.log('[seed:demo-data] credentials are derived from SEED_DEMO_PASSWORD with suffixes .')
  console.log('[seed:demo-data] password format: `<SEED_DEMO_PASSWORD>-<admin|manufacturer|customer>`')
} finally {
  await prisma.$disconnect()
}

function deriveDemoPassword(base: string, roleSuffix: string) {
  return `${base}-${roleSuffix}`
}

function isKnownInsecurePassword(password: string) {
  return ['1234567890j', 'password', 'password123', 'admin12345', 'change-me', 'replace-me'].includes(
    password.toLowerCase(),
  )
}

async function seedDemoData(
  db: Pick<DbClient, '$transaction'>,
  input: { passwordHashByRole: Record<DemoUserRole, string> },
) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email: 'admin-demo@bicycle-rent.local' },
      update: {
        passwordHash: input.passwordHashByRole.admin,
        displayName: 'Demo Admin',
        role: 'admin',
        status: 'active',
      },
      create: {
        email: 'admin-demo@bicycle-rent.local',
        passwordHash: input.passwordHashByRole.admin,
        displayName: 'Demo Admin',
        role: 'admin',
        status: 'active',
      },
    })

    const manufacturer = await tx.user.upsert({
      where: { email: 'owner@riverline-bikes.local' },
      update: {
        passwordHash: input.passwordHashByRole.manufacturer,
        displayName: 'Dmitry Riverline',
        role: 'manufacturer',
        status: 'active',
      },
      create: {
        email: 'owner@riverline-bikes.local',
        passwordHash: input.passwordHashByRole.manufacturer,
        displayName: 'Dmitry Riverline',
        role: 'manufacturer',
        status: 'active',
      },
    })

    const customer = await tx.user.upsert({
      where: { email: 'guest@demo-rent.local' },
      update: {
        passwordHash: input.passwordHashByRole.customer,
        displayName: 'Demo Guest',
        role: 'user',
        status: 'active',
      },
      create: {
        email: 'guest@demo-rent.local',
        passwordHash: input.passwordHashByRole.customer,
        displayName: 'Demo Guest',
        role: 'user',
        status: 'active',
      },
    })

    await revokeActiveSessions(tx, [admin.id, manufacturer.id, customer.id])

    const profile = await tx.manufacturerProfile.upsert({
      where: { userId: manufacturer.id },
      update: {
        legalName: 'Riverline Bikes',
        publicName: 'Riverline Bikes',
        region: 'Воронежская область',
        city: 'Воронеж',
        phone: '+7 473 111-22-33',
        email: 'owner@riverline-bikes.local',
        description:
          'Компания Riverline Bikes делает городской и туристический сегмент доступным: проверенные байки, быстрые ответвления и ясные условия аренды.',
        status: 'approved',
        moderationComment: null,
        submittedAt: new Date('2026-05-10T10:00:00Z'),
        reviewedAt: new Date('2026-05-10T12:00:00Z'),
      },
      create: {
        userId: manufacturer.id,
        legalName: 'Riverline Bikes',
        publicName: 'Riverline Bikes',
        region: 'Воронежская область',
        city: 'Воронеж',
        phone: '+7 473 111-22-33',
        email: 'owner@riverline-bikes.local',
        description:
          'Компания Riverline Bikes делает городской и туристический сегмент доступным: проверенные байки, быстрые ответвления и ясные условия аренды.',
        status: 'approved',
        moderationComment: null,
        submittedAt: new Date('2026-05-10T10:00:00Z'),
        reviewedAt: new Date('2026-05-10T12:00:00Z'),
      },
    })

    for (const bike of bicycleFixtures) {
      const existing = await tx.bicycle.findFirst({
        where: {
          manufacturerProfileId: profile.id,
          title: bike.title,
        },
      })

      const payload = {
        ...bike,
        manufacturerProfileId: profile.id,
      }

      if (existing) {
        await tx.bicycle.update({
          where: { id: existing.id },
          data: payload,
        })
      } else {
        await tx.bicycle.create({
          data: payload,
        })
      }
    }

    const storedBicycles = await tx.bicycle.findMany({
      where: { manufacturerProfileId: profile.id },
      orderBy: { title: 'asc' },
    })

    if (!storedBicycles.length) {
      throw new Error('Demo bicycles were not created')
    }

    const firstBike =
      storedBicycles.find((bicycle) => bicycle.title === 'Ridge Trail 500') ?? storedBicycles[0]
    const secondBike =
      storedBicycles.find((bicycle) => bicycle.title === 'City Rider 300') ?? storedBicycles[1]

    const demoOrders = [
      {
        status: 'request' as const,
        startsOn: '2026-06-05',
        endsOn: '2026-06-08',
        rentalDays: 4,
        fulfillmentType: 'pickup' as const,
        deliveryAddress: null,
        contactName: 'Demo Request',
        contactPhone: '+7 900 111 22 11',
        userComment: 'Проверочный заказ для демо.',
        items: [firstBike],
        statusHistory: null as const,
      },
      {
        status: 'confirmed' as const,
        startsOn: '2026-06-12',
        endsOn: '2026-06-13',
        rentalDays: 2,
        fulfillmentType: 'delivery' as const,
        deliveryAddress: 'ул. Ленина, 34',
        contactName: 'Demo Confirmed',
        contactPhone: '+7 900 111 22 22',
        userComment: 'Заказ с подтверждением в демо-данных.',
        items: [secondBike],
        statusHistory: {
          fromStatus: 'request' as const,
          toStatus: 'confirmed' as const,
          changedByUserId: admin.id,
          comment: 'Стартовые данные для демо-окна.',
        },
      },
    ]

    const orderedBicycles = new Map(storedBicycles.map((bicycle) => [bicycle.id, bicycle]))
    const orderCount = await Promise.all(
      demoOrders.map(async (fixture) => {
        const existingOrder = await tx.order.findFirst({
          where: {
            userId: customer.id,
            contactName: fixture.contactName,
            startsOn: fixture.startsOn,
            endsOn: fixture.endsOn,
          },
        })
        if (existingOrder) {
          return 0
        }

        const item = fixture.items[0]
        const itemData = orderedBicycles.get(item.id)

        if (!itemData) {
          throw new Error(`Expected seeded bicycle ${item.id} to exist`)
        }

        const rentalAmountKopecks = itemData.pricePerDayKopecks * fixture.rentalDays
        const depositAmountKopecks = itemData.depositKopecks
        const deliveryAmountKopecks =
          fixture.fulfillmentType === 'delivery'
            ? 800
            : 0

        await tx.order.create({
          data: {
            userId: customer.id,
            status: fixture.status,
            startsOn: fixture.startsOn,
            endsOn: fixture.endsOn,
            rentalDays: fixture.rentalDays,
            fulfillmentType: fixture.fulfillmentType,
            deliveryAddress: fixture.deliveryAddress,
            contactName: fixture.contactName,
            contactPhone: fixture.contactPhone,
            userComment: fixture.userComment,
            rentalAmountKopecks,
            depositAmountKopecks,
            deliveryAmountKopecks,
            totalAmountKopecks: rentalAmountKopecks + depositAmountKopecks + deliveryAmountKopecks,
            adminComment: null,
            safetyAgreementAcceptedAt: new Date('2026-06-01T09:00:00Z'),
            items: {
              create: [
                {
                  bicycleId: itemData.id,
                  pricePerDaySnapshotKopecks: itemData.pricePerDayKopecks,
                  depositSnapshotKopecks: itemData.depositKopecks,
                  bicycleTitleSnapshot: itemData.title,
                  bicycleSizeSnapshot: itemData.size,
                  bicycleCitySnapshot: itemData.city,
                  bicyclePickupAddressSnapshot: itemData.pickupAddress,
                  bicycleDeliveryAvailableSnapshot: itemData.deliveryAvailable,
                  manufacturerProfileIdSnapshot: profile.id,
                  manufacturerPublicNameSnapshot: profile.publicName,
                  manufacturerRegionSnapshot: profile.region,
                  manufacturerCitySnapshot: profile.city,
                },
              ],
            },
            payments: {
              create: [
                {
                  type: 'deposit',
                  status: fixture.status === 'request' ? 'pending' : 'succeeded',
                  amountKopecks: depositAmountKopecks,
                  currency: 'RUB',
                  completedAt: fixture.status === 'request' ? null : new Date('2026-06-01T09:30:00Z'),
                },
                {
                  type: 'rent',
                  status: fixture.status === 'confirmed' ? 'succeeded' : 'pending',
                  amountKopecks: rentalAmountKopecks + deliveryAmountKopecks,
                  currency: 'RUB',
                  completedAt:
                    fixture.status === 'confirmed'
                      ? new Date('2026-06-01T09:30:00Z')
                      : null,
                },
              ],
            },
            statusHistory: fixture.statusHistory
              ? {
                  create: {
                    fromStatus: fixture.statusHistory.fromStatus,
                    toStatus: fixture.statusHistory.toStatus,
                    changedByUserId: fixture.statusHistory.changedByUserId,
                    comment: fixture.statusHistory.comment,
                  },
                }
              : undefined,
          },
        })
        return 1
      }),
    )

    return {
      admin,
      manufacturer,
      customer,
      profile,
      bicycleIds: storedBicycles.map((bicycle) => bicycle.id),
      orderCount: orderCount.reduce((total, count) => total + count, 0),
    }
  })
}

async function revokeActiveSessions(db: Pick<DbClient, 'authSession'>, userIds: string[]) {
  for (const userId of userIds) {
    await db.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }
}

function isLocalDatabaseUrl(databaseUrl: string) {
  try {
    const { hostname } = new URL(databaseUrl)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}
