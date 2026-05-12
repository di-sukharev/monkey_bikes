import { describe, expect, test } from 'bun:test'
import {
  adminUpdateUserRequestSchema,
  adminUsersQuerySchema,
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
    })
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
})
