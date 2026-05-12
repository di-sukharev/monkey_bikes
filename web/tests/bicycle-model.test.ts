import { describe, expect, test } from 'bun:test'

import {
  adminBicycleStatusOptionsFor,
  canAdminApproveBicycle,
  canManufacturerEditBicycle,
  canManufacturerSubmitBicycle,
} from '../src/features/bicycles/model'

describe('bicycle UI status rules', () => {
  test('matches manufacturer actions to backend-editable bicycle states', () => {
    expect(canManufacturerEditBicycle('draft')).toBe(true)
    expect(canManufacturerEditBicycle('moderation')).toBe(true)
    expect(canManufacturerEditBicycle('available')).toBe(true)
    expect(canManufacturerEditBicycle('hidden')).toBe(false)
    expect(canManufacturerEditBicycle('maintenance')).toBe(false)
    expect(canManufacturerEditBicycle('archived')).toBe(false)

    expect(canManufacturerSubmitBicycle('draft')).toBe(true)
    expect(canManufacturerSubmitBicycle('rejected')).toBe(true)
    expect(canManufacturerSubmitBicycle('available')).toBe(false)
    expect(canManufacturerSubmitBicycle('moderation')).toBe(false)
  })

  test('exposes only backend-valid admin status transitions', () => {
    expect(adminBicycleStatusOptionsFor('moderation', 'approved')).toEqual([])
    expect(adminBicycleStatusOptionsFor('draft', 'approved')).toEqual([])
    expect(adminBicycleStatusOptionsFor('archived', 'approved')).toEqual([])
    expect(adminBicycleStatusOptionsFor('available', 'approved')).toEqual([
      'hidden',
      'maintenance',
      'archived',
    ])
    expect(adminBicycleStatusOptionsFor('hidden', 'approved')).toEqual([
      'available',
      'maintenance',
      'archived',
    ])
    expect(adminBicycleStatusOptionsFor('reserved', 'approved')).toEqual([
      'hidden',
      'maintenance',
      'archived',
    ])
    expect(adminBicycleStatusOptionsFor('rented', 'approved')).toEqual([])
  })

  test('does not expose publish actions for bicycles owned by non-approved manufacturers', () => {
    expect(canAdminApproveBicycle('moderation', 'approved')).toBe(true)
    expect(canAdminApproveBicycle('moderation', 'blocked')).toBe(false)
    expect(canAdminApproveBicycle('available', 'approved')).toBe(false)

    expect(adminBicycleStatusOptionsFor('hidden', 'blocked')).toEqual([
      'maintenance',
      'archived',
    ])
    expect(adminBicycleStatusOptionsFor('maintenance', 'rejected')).toEqual([
      'hidden',
      'archived',
    ])
  })
})
