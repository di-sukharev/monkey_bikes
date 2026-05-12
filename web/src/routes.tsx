import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import {
  AdminManufacturersPage,
  AdminUsersPage,
  AppPage,
  HomePage,
  ManufacturerProfilePage,
  RootLayout,
} from './pages'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: AdminUsersPage,
})

const adminManufacturersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/manufacturers',
  component: AdminManufacturersPage,
})

const manufacturerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/profile',
  component: ManufacturerProfilePage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  adminUsersRoute,
  adminManufacturersRoute,
  manufacturerProfileRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
