import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import {
  AdminBicyclesPage,
  BicycleDetailPage,
  CatalogPage,
  ManufacturerBicyclesPage,
} from './features/bicycles/pages'
import { AdminManufacturersPage, ManufacturerProfilePage } from './features/manufacturers/pages'
import {
  AdminOrderDetailPage,
  AdminOrdersPage,
  OrderDetailPage,
  OrderRequestPage,
  OrdersPage,
} from './features/orders/pages'
import { AdminUsersPage, AppPage, HomePage, RootLayout } from './pages'

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

const adminBicyclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/bicycles',
  component: AdminBicyclesPage,
})

const adminOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/orders',
  component: AdminOrdersPage,
})

const adminOrderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/orders/$id',
  component: AdminOrderDetailPage,
})

const manufacturerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/profile',
  component: ManufacturerProfilePage,
})

const manufacturerBicyclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/bicycles',
  component: ManufacturerBicyclesPage,
})

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bicycles',
  component: CatalogPage,
})

const bicycleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bicycles/$id',
  component: BicycleDetailPage,
})

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersPage,
})

const newOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/new',
  validateSearch: (search: Record<string, unknown>) => ({
    bicycleIds: typeof search.bicycleIds === 'string' ? search.bicycleIds : undefined,
  }),
  component: OrderRequestPage,
})

const orderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$id',
  component: OrderDetailPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  adminUsersRoute,
  adminManufacturersRoute,
  adminBicyclesRoute,
  adminOrdersRoute,
  adminOrderDetailRoute,
  manufacturerProfileRoute,
  manufacturerBicyclesRoute,
  catalogRoute,
  bicycleDetailRoute,
  ordersRoute,
  newOrderRoute,
  orderDetailRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
