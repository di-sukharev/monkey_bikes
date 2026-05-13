import { describe, expect, test } from 'bun:test'

import { normalizePgConnectionString } from './db'

describe('database connection strings', () => {
  test('keeps DigitalOcean sslmode=require compatible with pg adapter TLS behavior', () => {
    const normalized = normalizePgConnectionString(
      'postgresql://user:password@example.com:25060/defaultdb?sslmode=require',
    )

    expect(normalized).toContain('sslmode=require')
    expect(normalized).toContain('uselibpqcompat=true')
  })

  test('preserves explicit libpq compatibility choice', () => {
    const normalized = normalizePgConnectionString(
      'postgresql://user:password@example.com:25060/defaultdb?sslmode=require&uselibpqcompat=false',
    )

    expect(normalized).toContain('uselibpqcompat=false')
  })
})
