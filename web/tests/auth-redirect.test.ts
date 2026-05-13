import { expect, test } from 'bun:test'

import { sanitizeRedirectTo } from '../src/lib/auth-redirect'

test('sanitizeRedirectTo keeps internal paths with query and hash', () => {
  expect(sanitizeRedirectTo('/admin/users')).toBe('/admin/users')
  expect(sanitizeRedirectTo('/admin/orders?quickFilter=orders_today#top')).toBe(
    '/admin/orders?quickFilter=orders_today#top',
  )
})

test('sanitizeRedirectTo rejects external and empty redirects', () => {
  expect(sanitizeRedirectTo(null)).toBeNull()
  expect(sanitizeRedirectTo('')).toBeNull()
  expect(sanitizeRedirectTo('admin/users')).toBeNull()
  expect(sanitizeRedirectTo('https://example.com/admin/users')).toBeNull()
  expect(sanitizeRedirectTo('//example.com/admin/users')).toBeNull()
})
