import type { UserRole } from '@web-app-demo/contracts'
import {
  BikeIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FactoryIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react'

export type SidebarRoute =
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

export type SidebarNavigationItem = {
  title: string
  to: SidebarRoute
  icon: LucideIcon
  exact?: boolean
}

export type SidebarNavigationGroup = {
  title: string
  items: SidebarNavigationItem[]
}

const baseItems: SidebarNavigationItem[] = [
  { title: 'Профиль', to: '/app', icon: UserRoundIcon, exact: true },
  { title: 'Каталог', to: '/bicycles', icon: BikeIcon },
]

export function getSidebarNavigation(role: UserRole): SidebarNavigationGroup[] {
  const mainGroup: SidebarNavigationGroup = {
    title: 'Основное',
    items: [...baseItems],
  }

  if (role === 'user') {
    return [
      {
        ...mainGroup,
        items: [
          ...mainGroup.items,
          { title: 'Мои заказы', to: '/orders', icon: ClipboardListIcon },
        ],
      },
    ]
  }

  if (role === 'manufacturer') {
    return [
      mainGroup,
      {
        title: 'Производитель',
        items: [
          { title: 'Профиль', to: '/manufacturer/profile', icon: FactoryIcon, exact: true },
          { title: 'Мои велосипеды', to: '/manufacturer/bicycles', icon: BikeIcon },
          { title: 'Заказы', to: '/manufacturer/orders', icon: ClipboardListIcon },
        ],
      },
    ]
  }

  return [
    mainGroup,
    {
      title: 'Администрирование',
      items: [
        { title: 'Админка', to: '/admin', icon: ShieldCheckIcon, exact: true },
        { title: 'Пользователи', to: '/admin/users', icon: UsersRoundIcon, exact: true },
        { title: 'Производители', to: '/admin/manufacturers', icon: FactoryIcon, exact: true },
        { title: 'Велосипеды', to: '/admin/bicycles', icon: BikeIcon },
        { title: 'Заказы', to: '/admin/orders', icon: ClipboardListIcon },
        { title: 'Платежи', to: '/admin/payments', icon: CreditCardIcon, exact: true },
        { title: 'Чеклисты', to: '/admin/checklists', icon: ClipboardCheckIcon },
        { title: 'Отчеты', to: '/admin/reports', icon: ChartColumnIcon, exact: true },
      ],
    },
  ]
}
