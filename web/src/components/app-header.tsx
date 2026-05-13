import { Link, useLocation } from '@tanstack/react-router'
import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'

type BreadcrumbRoute =
  | '/'
  | '/app'
  | '/admin'
  | '/admin/users'
  | '/admin/manufacturers'
  | '/admin/bicycles'
  | '/admin/orders'
  | '/admin/payments'
  | '/admin/checklists'
  | '/admin/reports'
  | '/manufacturer/profile'
  | '/manufacturer/bicycles'
  | '/manufacturer/orders'
  | '/bicycles'
  | '/orders'

type AppBreadcrumb = {
  label: string
  to?: BreadcrumbRoute
}

export function AppHeader() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const breadcrumbs = getBreadcrumbs(pathname)

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      <SidebarTrigger aria-label="Открыть меню" className="-ml-1" />
      <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap overflow-hidden text-base">
          {breadcrumbs.map((breadcrumb, index) => {
            const isCurrent = index === breadcrumbs.length - 1

            return (
              <Fragment key={`${breadcrumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator className="shrink-0" />}
                <BreadcrumbItem className="min-w-0 shrink">
                  {isCurrent || !breadcrumb.to ? (
                    <BreadcrumbPage className="truncate">{breadcrumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="truncate">
                      <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}

function getBreadcrumbs(pathname: string): AppBreadcrumb[] {
  if (pathname.startsWith('/admin/orders/')) {
    return [
      { label: 'Администрирование', to: '/admin' },
      { label: 'Заказы', to: '/admin/orders' },
      { label: 'Заказ' },
    ]
  }

  if (pathname.startsWith('/manufacturer/orders/')) {
    return [
      { label: 'Производитель', to: '/manufacturer/profile' },
      { label: 'Заказы', to: '/manufacturer/orders' },
      { label: 'Заказ' },
    ]
  }

  if (pathname.startsWith('/bicycles/')) {
    return [
      { label: 'Велопрокат', to: '/' },
      { label: 'Каталог', to: '/bicycles' },
      { label: 'Велосипед' },
    ]
  }

  if (pathname === '/orders/new') {
    return [
      { label: 'Велопрокат', to: '/' },
      { label: 'Мои заказы', to: '/orders' },
      { label: 'Новая заявка' },
    ]
  }

  if (pathname.startsWith('/orders/')) {
    return [
      { label: 'Велопрокат', to: '/' },
      { label: 'Мои заказы', to: '/orders' },
      { label: 'Заказ' },
    ]
  }

  return breadcrumbByPath[pathname] ?? [{ label: 'Велопрокат' }]
}

const breadcrumbByPath: Record<string, AppBreadcrumb[]> = {
  '/': [{ label: 'Велопрокат' }],
  '/app': [
    { label: 'Велопрокат', to: '/' },
    { label: 'Профиль' },
  ],
  '/admin': [{ label: 'Администрирование' }],
  '/admin/users': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Пользователи' },
  ],
  '/admin/manufacturers': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Производители' },
  ],
  '/admin/bicycles': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Велосипеды' },
  ],
  '/admin/orders': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Заказы' },
  ],
  '/admin/payments': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Платежи' },
  ],
  '/admin/checklists': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Чеклисты' },
  ],
  '/admin/reports': [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Отчеты' },
  ],
  '/manufacturer/profile': [
    { label: 'Производитель' },
    { label: 'Профиль' },
  ],
  '/manufacturer/bicycles': [
    { label: 'Производитель', to: '/manufacturer/profile' },
    { label: 'Мои велосипеды' },
  ],
  '/manufacturer/orders': [
    { label: 'Производитель', to: '/manufacturer/profile' },
    { label: 'Заказы' },
  ],
  '/bicycles': [
    { label: 'Велопрокат', to: '/' },
    { label: 'Каталог' },
  ],
  '/orders': [
    { label: 'Велопрокат', to: '/' },
    { label: 'Мои заказы' },
  ],
}
