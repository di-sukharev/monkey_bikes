import { expect, test } from 'bun:test'
import type { UserRole } from '@web-app-demo/contracts'

import { getSidebarNavigation } from '../src/lib/sidebar-navigation'

function routesFor(role: UserRole) {
  return getSidebarNavigation(role).flatMap((group) => group.items.map((item) => item.to))
}

function titlesFor(role: UserRole) {
  return getSidebarNavigation(role).flatMap((group) => group.items.map((item) => item.title))
}

function groupTitlesFor(role: UserRole) {
  return getSidebarNavigation(role).map((group) => group.title)
}

test('customer sidebar exposes profile, catalog, and customer orders only', () => {
  expect(groupTitlesFor('user')).toEqual(['Основное'])
  expect(routesFor('user')).toEqual(['/app', '/bicycles', '/orders'])
  expect(titlesFor('user')).not.toContain('Вход')
  expect(routesFor('user')).not.toContain('/manufacturer/profile')
  expect(routesFor('user')).not.toContain('/admin')
})

test('manufacturer sidebar exposes producer workspace without customer or admin sections', () => {
  expect(groupTitlesFor('manufacturer')).toEqual(['Основное', 'Производитель'])
  expect(routesFor('manufacturer')).toEqual([
    '/app',
    '/bicycles',
    '/manufacturer/profile',
    '/manufacturer/bicycles',
    '/manufacturer/orders',
  ])
  expect(titlesFor('manufacturer')).not.toContain('Вход')
  expect(routesFor('manufacturer')).not.toContain('/orders')
  expect(routesFor('manufacturer')).not.toContain('/admin')
})

test('admin sidebar exposes administration workspace without customer or producer sections', () => {
  expect(groupTitlesFor('admin')).toEqual(['Основное', 'Администрирование'])
  expect(routesFor('admin')).toEqual([
    '/app',
    '/bicycles',
    '/admin',
    '/admin/users',
    '/admin/manufacturers',
    '/admin/bicycles',
    '/admin/orders',
    '/admin/payments',
    '/admin/checklists',
    '/admin/reports',
  ])
  expect(titlesFor('admin')).not.toContain('Вход')
  expect(routesFor('admin')).not.toContain('/orders')
  expect(routesFor('admin')).not.toContain('/manufacturer/profile')
})
