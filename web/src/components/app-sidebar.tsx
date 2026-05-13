import { Link, useLocation } from '@tanstack/react-router'
import type { UserRole } from '@web-app-demo/contracts'
import {
  BikeIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FactoryIcon,
  LogInIcon,
  LogOutIcon,
  MoreVerticalIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { userRoleLabel } from '@/lib/user-labels'
import { useAuth } from '@/lib/use-auth'

type SidebarRoute =
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

type NavigationItem = {
  title: string
  to: SidebarRoute
  icon: LucideIcon
  exact?: boolean
}

type NavigationGroup = {
  title: string
  items: NavigationItem[]
}

export function AppSidebar({ className, ...props }: ComponentProps<typeof Sidebar>) {
  const auth = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const groups = getNavigationGroups(auth.user?.role, auth.isAuthenticated)
  const displayName = auth.user?.displayName ?? auth.user?.email ?? 'Гость'
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar className={className} collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Велопрокат">
              <Link to="/" activeOptions={{ exact: true }} onClick={closeMobileSidebar}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  BR
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Велопрокат</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Маркетплейс
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavigationItemActive(pathname, item)}
                      tooltip={item.title}
                    >
                      <Link
                        to={item.to}
                        activeOptions={{ exact: item.exact }}
                        onClick={closeMobileSidebar}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {auth.user && (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip={displayName}>
                <Link
                  to="/app"
                  activeOptions={{ exact: true }}
                  aria-label={`${displayName}, ${userRoleLabel(auth.user.role)}, открыть профиль`}
                  onClick={closeMobileSidebar}
                >
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <UserRoundIcon />
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {userRoleLabel(auth.user.role)}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction aria-label="Открыть меню пользователя">
                    <MoreVerticalIcon />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isMobile ? 'end' : 'start'}
                  className="min-w-36"
                  side={isMobile ? 'bottom' : 'right'}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      closeMobileSidebar()
                      void auth.logout()
                    }}
                  >
                    <LogOutIcon />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}

function getNavigationGroups(role: UserRole | undefined, isAuthenticated: boolean) {
  const groups: NavigationGroup[] = [
    {
      title: 'Основное',
      items: [
        ...(!isAuthenticated
          ? [{ title: 'Вход', to: '/', icon: LogInIcon, exact: true } satisfies NavigationItem]
          : []),
        { title: 'Профиль', to: '/app', icon: UserRoundIcon, exact: true },
        { title: 'Каталог', to: '/bicycles', icon: BikeIcon },
      ],
    },
  ]

  if (role === 'user') {
    groups[0].items.push({
      title: 'Мои заказы',
      to: '/orders',
      icon: ClipboardListIcon,
    })
  }

  if (role === 'manufacturer') {
    groups.push({
      title: 'Производитель',
      items: [
        { title: 'Профиль', to: '/manufacturer/profile', icon: FactoryIcon, exact: true },
        { title: 'Мои велосипеды', to: '/manufacturer/bicycles', icon: BikeIcon },
        { title: 'Заказы', to: '/manufacturer/orders', icon: ClipboardListIcon },
      ],
    })
  }

  if (role === 'admin') {
    groups.push({
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
    })
  }

  return groups
}

function isNavigationItemActive(pathname: string, item: NavigationItem) {
  if (item.exact) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
