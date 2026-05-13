import { Link, useLocation } from '@tanstack/react-router'
import {
  LogOutIcon,
  MoreVerticalIcon,
  UserRoundIcon,
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
import {
  getSidebarNavigation,
  type SidebarNavigationItem,
} from '@/lib/sidebar-navigation'
import { userRoleLabel } from '@/lib/user-labels'
import { useAuth } from '@/lib/use-auth'

export function AppSidebar({ className, ...props }: ComponentProps<typeof Sidebar>) {
  const auth = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const user = auth.user
  const groups = user ? getSidebarNavigation(user.role) : []
  const displayName = user?.displayName ?? user?.email ?? 'Гость'
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
      {user && (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip={displayName}>
                <Link
                  to="/app"
                  activeOptions={{ exact: true }}
                  aria-label={`${displayName}, ${userRoleLabel(user.role)}, открыть профиль`}
                  onClick={closeMobileSidebar}
                >
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <UserRoundIcon />
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {userRoleLabel(user.role)}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    aria-label="Открыть меню пользователя"
                    className="top-1/2 right-2 -translate-y-1/2 peer-data-[size=lg]/menu-button:top-1/2"
                  >
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
            <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
              <SidebarMenuButton asChild tooltip="Выйти">
                <button
                  type="button"
                  aria-label="Выйти из аккаунта"
                  onClick={() => {
                    closeMobileSidebar()
                    void auth.logout()
                  }}
                >
                  <LogOutIcon />
                  <span>Выйти</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}

function isNavigationItemActive(pathname: string, item: SidebarNavigationItem) {
  if (item.exact) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
