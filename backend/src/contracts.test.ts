import { describe, expect, test } from 'bun:test'
import {
  adminManufacturerStatusUpdateRequestSchema,
  adminUpdateUserRequestSchema,
  adminUsersQuerySchema,
  manufacturerProfileSchema,
  manufacturerProfileSubmitResponseSchema,
  manufacturerProfileUpsertRequestSchema,
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
})
