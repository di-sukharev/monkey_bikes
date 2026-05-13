import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'bun:test'

import { clearSessionQueryCache, meQueryKey } from '../src/lib/auth-cache'

test('clearSessionQueryCache removes private account-scoped queries', async () => {
  const queryClient = new QueryClient()

  queryClient.setQueryData(meQueryKey, { user: { id: 'manufacturer_a' } })
  queryClient.setQueryData(['manufacturer', 'profile', 'manufacturer_a'], {
    profile: { publicName: 'Manufacturer A' },
  })
  queryClient.setQueryData(['manufacturer', 'orders', 'manufacturer_a', 1, 'current', 'all'], {
    items: [{ id: 'order_1' }],
  })
  queryClient.setQueryData(['manufacturer', 'orders', 'manufacturer_a', 'order_1'], {
    order: { id: 'order_1' },
  })
  queryClient.setQueryData(['admin', 'users', 1], { items: [{ id: 'user_1' }] })
  queryClient.setQueryData(['orders', 'user_1', 1, 'current', 'all'], {
    items: [{ id: 'order_1' }],
  })
  queryClient.setQueryData(['orders', 'user_1', 'order_1'], {
    order: { id: 'order_1' },
  })
  queryClient.setQueryData(['public', 'catalog'], { items: [{ id: 'bike_1' }] })

  await clearSessionQueryCache(queryClient)

  expect(queryClient.getQueryData(meQueryKey)).toBeUndefined()
  expect(queryClient.getQueryData(['manufacturer', 'profile', 'manufacturer_a'])).toBeUndefined()
  expect(queryClient.getQueryData(['manufacturer', 'orders', 'manufacturer_a', 1, 'current', 'all'])).toBeUndefined()
  expect(queryClient.getQueryData(['manufacturer', 'orders', 'manufacturer_a', 'order_1'])).toBeUndefined()
  expect(queryClient.getQueryData(['admin', 'users', 1])).toBeUndefined()
  expect(queryClient.getQueryData(['orders', 'user_1', 1, 'current', 'all'])).toBeUndefined()
  expect(queryClient.getQueryData(['orders', 'user_1', 'order_1'])).toBeUndefined()
  expect(queryClient.getQueryData(['public', 'catalog'])).toEqual({
    items: [{ id: 'bike_1' }],
  })
})
