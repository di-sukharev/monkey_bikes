import { describe, expect, test } from 'bun:test'

import { rentalDaysInclusive } from './service'

describe('order date rules', () => {
  test('counts rental days inclusively without local timezone math', () => {
    expect(rentalDaysInclusive('2026-05-12', '2026-05-12')).toBe(1)
    expect(rentalDaysInclusive('2026-05-12', '2026-05-13')).toBe(2)
    expect(rentalDaysInclusive('2028-02-28', '2028-03-01')).toBe(3)
    expect(rentalDaysInclusive('2026-12-31', '2027-01-02')).toBe(3)
  })

  test('rejects invalid or inverted date-only values', () => {
    expect(() => rentalDaysInclusive('2026-02-30', '2026-03-01')).toThrow()
    expect(() => rentalDaysInclusive('2026-2-03', '2026-03-04')).toThrow()
    expect(() => rentalDaysInclusive('2026-05-13', '2026-05-12')).toThrow()
  })
})
