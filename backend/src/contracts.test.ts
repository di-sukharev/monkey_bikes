import { describe, expect, test } from 'bun:test'
import {
  adminBicycleModerationRequestSchema,
  adminBicycleSchema,
  adminManufacturerStatusUpdateRequestSchema,
  adminUpdateUserRequestSchema,
  adminUsersQuerySchema,
  bicycleSchema,
  bicycleUpsertRequestSchema,
  manufacturerProfileSchema,
  manufacturerProfileSubmitResponseSchema,
  manufacturerProfileUpsertRequestSchema,
  publicBicyclesQuerySchema,
  registerRequestSchema,
  userSchema,
} from '@web-app-demo/contracts'

describe('contracts', () => {
  test('normalizes auth registration payloads', () => {
    const result = registerRequestSchema.parse({
      email: ' USER@Example.COM ',
      password: 'password123',
      displayName: '',
    })

    expect(result).toEqual({
      email: 'user@example.com',
      password: 'password123',
      displayName: undefined,
      role: 'user',
    })
  })

  test('allows manufacturer self-registration without admin role escalation', () => {
    const result = registerRequestSchema.parse({
      email: ' maker@example.com ',
      password: 'password123',
      role: 'manufacturer',
    })

    expect(result.role).toBe('manufacturer')
    expect(() =>
      registerRequestSchema.parse({
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      }),
    ).toThrow()
  })

  test('parses user role and status DTO fields', () => {
    const result = userSchema.parse({
      id: 'user_1',
      email: 'user@example.com',
      displayName: null,
      role: 'manufacturer',
      status: 'active',
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    })

    expect(result.role).toBe('manufacturer')
    expect(result.status).toBe('active')
  })

  test('normalizes admin users query defaults', () => {
    const result = adminUsersQuerySchema.parse({})

    expect(result).toEqual({
      page: 1,
      pageSize: 20,
    })
  })

  test('requires at least one admin user patch field', () => {
    expect(() => adminUpdateUserRequestSchema.parse({})).toThrow()
    expect(adminUpdateUserRequestSchema.parse({ status: 'blocked' })).toEqual({
      status: 'blocked',
    })
  })

  test('normalizes manufacturer profile payloads and parses status DTOs', () => {
    const payload = manufacturerProfileUpsertRequestSchema.parse({
      legalName: ' Tiny Bikes Ltd ',
      publicName: ' Tiny Bikes ',
      region: '',
      city: ' Москва ',
      phone: ' +7 999 000-00-00 ',
      email: ' MAKER@Example.COM ',
      description: ' Compact bicycles for circus acts ',
    })

    expect(payload).toEqual({
      legalName: 'Tiny Bikes Ltd',
      publicName: 'Tiny Bikes',
      region: null,
      city: 'Москва',
      phone: '+7 999 000-00-00',
      email: 'maker@example.com',
      description: 'Compact bicycles for circus acts',
    })

    const profile = manufacturerProfileSchema.parse({
      id: 'manufacturer_1',
      userId: 'user_1',
      legalName: 'Tiny Bikes Ltd',
      publicName: 'Tiny Bikes',
      region: null,
      city: 'Москва',
      phone: '+7 999 000-00-00',
      email: 'maker@example.com',
      description: 'Compact bicycles for circus acts',
      status: 'moderation',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: null,
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    })

    expect(profile.status).toBe('moderation')
  })

  test('rejects wrong-type manufacturer optional fields instead of dropping them', () => {
    expect(() =>
      manufacturerProfileUpsertRequestSchema.parse({
        legalName: 'Tiny Bikes Ltd',
        publicName: 'Tiny Bikes',
        region: 123,
        city: 'Москва',
        phone: '+7 999 000-00-00',
        email: 'maker@example.com',
        description: 'Compact bicycles for circus acts',
      }),
    ).toThrow()
  })

  test('requires moderation comments for rejected and blocked manufacturer decisions', () => {
    expect(() =>
      adminManufacturerStatusUpdateRequestSchema.parse({
        status: 'rejected',
      }),
    ).toThrow()

    expect(adminManufacturerStatusUpdateRequestSchema.parse({
      status: 'approved',
      moderationComment: '',
    })).toEqual({
      status: 'approved',
      moderationComment: null,
    })

    expect(manufacturerProfileSubmitResponseSchema.parse({
        profile: {
          id: 'manufacturer_1',
          userId: 'user_1',
          legalName: 'Tiny Bikes Ltd',
          publicName: 'Tiny Bikes',
          region: null,
          city: 'Москва',
          phone: '+7 999 000-00-00',
          email: 'maker@example.com',
          description: 'Compact bicycles for circus acts',
          status: 'moderation',
          moderationComment: null,
        submittedAt: '2026-05-12T10:00:00.000Z',
        reviewedAt: null,
        createdAt: '2026-05-12T09:00:00.000Z',
        updatedAt: '2026-05-12T10:00:00.000Z',
      },
    }).profile.status).toBe('moderation')
  })

  test('normalizes bicycle payloads and preserves money in kopecks', () => {
    const payload = bicycleUpsertRequestSchema.parse({
      title: ' Tiny Performer S ',
      description: ' Compact bicycle for controlled circus rehearsals. ',
      size: 'S',
      photoUrls: [' https://example.com/bike.jpg '],
      pricePerDayKopecks: '250000',
      depositKopecks: 500000,
      region: '',
      city: ' Москва ',
      pickupAddress: ' Main storage, door 2 ',
      deliveryAvailable: true,
      maxLoadKg: '12',
      seatHeightCm: 22,
      frameLengthCm: 40,
      wheelDiameterCm: 16,
      recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
      safetyNotes: 'Use only with trained handlers and indoor safety mats.',
    })

    expect(payload).toEqual({
      title: 'Tiny Performer S',
      description: 'Compact bicycle for controlled circus rehearsals.',
      size: 'S',
      photoUrls: ['https://example.com/bike.jpg'],
      pricePerDayKopecks: 250000,
      depositKopecks: 500000,
      region: null,
      city: 'Москва',
      pickupAddress: 'Main storage, door 2',
      deliveryAvailable: true,
      maxLoadKg: 12,
      seatHeightCm: 22,
      frameLengthCm: 40,
      wheelDiameterCm: 16,
      recommendedAnimalDimensions: 'Small trained animals up to 70 cm height',
      safetyNotes: 'Use only with trained handlers and indoor safety mats.',
    })

    expect(bicycleSchema.parse({
      id: 'bike_1',
      manufacturerProfileId: 'manufacturer_1',
      ...payload,
      status: 'moderation',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: null,
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    }).status).toBe('moderation')

    expect(adminBicycleSchema.parse({
      id: 'bike_1',
      manufacturerProfileId: 'manufacturer_1',
      ...payload,
      status: 'available',
      moderationComment: null,
      submittedAt: '2026-05-12T10:00:00.000Z',
      reviewedAt: '2026-05-12T11:00:00.000Z',
      createdAt: '2026-05-12T09:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
      manufacturer: {
        id: 'manufacturer_1',
        publicName: 'Tiny Bikes',
        city: 'Moscow',
        region: null,
        status: 'approved',
      },
    }).manufacturer.status).toBe('approved')
  })

  test('rejects unsafe bicycle payload and filter edge cases', () => {
    expect(() =>
      bicycleUpsertRequestSchema.parse({
        ...bicyclePayload('Tiny Performer S'),
        status: 'available',
      }),
    ).toThrow()

    expect(() =>
      bicycleUpsertRequestSchema.parse({
        ...bicyclePayload('Tiny Performer S'),
        photoUrls: ['not-a-url'],
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        minPriceKopecks: 1_000_000,
        maxPriceKopecks: 100_000,
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        startsOn: '2026-05-20',
      }),
    ).toThrow()

    expect(() =>
      publicBicyclesQuerySchema.parse({
        startsOn: '2026-02-30',
        endsOn: '2026-03-01',
      }),
    ).toThrow()

    expect(publicBicyclesQuerySchema.parse({
      sizes: 'S,M',
      startsOn: '2028-02-29',
      endsOn: '2028-03-01',
    }).sizes).toEqual(['S', 'M'])
  })

  test('requires moderation comments for rejected bicycle decisions', () => {
    expect(() =>
      adminBicycleModerationRequestSchema.parse({
        decision: 'rejected',
      }),
    ).toThrow()

    expect(adminBicycleModerationRequestSchema.parse({
      decision: 'approved',
      moderationComment: '',
    })).toEqual({
      decision: 'approved',
      moderationComment: null,
    })
  })
})

function bicyclePayload(title: string) {
  return {
    title,
    description: 'Compact bicycle for controlled circus rehearsals.',
    size: 'S',
    photoUrls: ['https://example.com/bike.jpg'],
    pricePerDayKopecks: 250000,
    depositKopecks: 500000,
    region: null,
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
