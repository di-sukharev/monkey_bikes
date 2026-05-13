import { Outlet, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminUpdateUserRequest } from '@web-app-demo/contracts'
import { ShieldCheckIcon, UserRoundIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AuthForm } from '@/components/AuthForm'
import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { HomeSessionCard } from '@/components/home-session-card'
import { PageHeading } from '@/components/page-heading'
import { FactCard, GateCard, LoadingState } from '@/components/page-state'
import { Badge } from '@/components/ui/badge'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { AdminUsersPanel } from '@/features/admin/admin-users-panel'
import { sanitizeRedirectTo } from '@/lib/auth-redirect'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { userRoleLabel, userStatusLabel } from '@/lib/user-labels'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const adminUsersPageSize = 20

const heroMonkeyTiles = [
  { emoji: '🙈', className: '-rotate-6 bg-chart-3' },
  { emoji: '🙉', className: 'rotate-3 bg-main' },
  { emoji: '🙊', className: '-rotate-3 bg-chart-4' },
] as const

const heroDecorationTiles = [
  { emoji: '🌴', className: 'top-14 left-12 size-28 -rotate-6 bg-chart-4 text-7xl lg:flex' },
  { emoji: '🚲', className: 'top-12 right-12 size-28 rotate-6 bg-secondary-background text-7xl lg:flex' },
  { emoji: '🍌', className: 'top-60 left-8 size-20 rotate-6 bg-chart-3 text-5xl xl:flex' },
  { emoji: '🎪', className: 'top-64 right-8 size-20 -rotate-6 bg-chart-3 text-5xl xl:flex' },
  { emoji: '✨', className: 'top-[29rem] left-10 size-16 -rotate-12 bg-secondary-background text-4xl xl:flex' },
  { emoji: '🎡', className: 'top-[31rem] right-10 size-16 rotate-12 bg-main text-4xl xl:flex' },
  { emoji: '🥥', className: 'bottom-20 left-16 size-20 rotate-3 bg-secondary-background text-5xl lg:flex' },
  { emoji: '🍍', className: 'bottom-12 left-[31%] size-16 -rotate-6 bg-chart-3 text-4xl xl:flex' },
  { emoji: '🧭', className: 'right-[25%] bottom-16 size-16 rotate-6 bg-chart-4 text-4xl xl:flex' },
  { emoji: '🌋', className: 'right-12 bottom-14 size-24 -rotate-3 bg-chart-2 text-6xl lg:flex' },
] as const

export function RootLayout() {
  const auth = useAuth()

  if (!auth.user) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

export function HomePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirectTo?: string }
  const redirectTo = sanitizeRedirectTo(search.redirectTo)

  useEffect(() => {
    if (!auth.isBootstrapping && auth.user && redirectTo) {
      void navigate({ href: redirectTo, replace: true })
    }
  }, [auth.isBootstrapping, auth.user, navigate, redirectTo])

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (auth.user && redirectTo) {
    return <LoadingState message="Открываем раздел..." />
  }

  if (auth.user) {
    return (
      <section className={pageShellClass}>
        <HomeSessionCard email={auth.user.email} />
      </section>
    )
  }

  return (
    <section
      className={cn(
        pageShellClass,
        'relative isolate grid min-h-[calc(100svh-3.5rem)] place-content-center gap-8 overflow-visible py-8 sm:py-10 lg:grid-cols-[minmax(0,560px)_minmax(360px,420px)] lg:items-center lg:gap-12 lg:py-8',
      )}
    >
      <HeroDecorations />
      <div className="relative z-10 mx-auto grid max-w-3xl justify-items-center gap-5 text-center lg:mx-0 lg:justify-items-start lg:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          <Badge variant="outline" className="px-3 py-1 text-sm sm:text-base">
            Маркетплейс велопроката
          </Badge>
          <HeroMonkeyTiles />
        </div>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Аренда маленьких велосипедов для обезьянок.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Не просто маленькие велосипеды, а мини-велопарк для обезьянок: клиенты выбирают
          транспорт, производители ведут каталог, администраторы отслеживают статусы, платежи
          и выдачу.
        </p>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[420px] lg:mx-0">
        <AuthForm />
      </div>
    </section>
  )
}

function HeroMonkeyTiles() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2 sm:gap-3">
      {heroMonkeyTiles.map((tile) => (
        <span
          key={tile.emoji}
          className={cn(
            'flex size-12 items-center justify-center rounded-base border-2 border-border text-3xl leading-none shadow-shadow sm:size-16 sm:text-5xl',
            tile.className,
          )}
        >
          {tile.emoji}
        </span>
      ))}
    </div>
  )
}

function HeroDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {heroDecorationTiles.map((tile) => (
        <div
          key={tile.emoji}
          className={cn(
            'absolute hidden items-center justify-center rounded-base border-2 border-border shadow-shadow',
            tile.className,
          )}
        >
          {tile.emoji}
        </div>
      ))}
    </div>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return <LoadingState message="Проверяем сессию..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-6')}>
      <PageHeading
        eyebrow="Текущий пользователь"
        eyebrowTone="secondary"
        title={auth.user.displayName ?? auth.user.email}
        description={auth.user.email}
        size="page"
      />

      <dl className="grid gap-4 sm:grid-cols-2">
        <FactCard label="ID пользователя" value={auth.user.id} icon={<UserRoundIcon />} />
        <FactCard label="Создан" value={new Date(auth.user.createdAt).toLocaleString('ru-RU')} />
        <FactCard label="Роль" value={userRoleLabel(auth.user.role)} icon={<ShieldCheckIcon />} />
        <FactCard label="Статус" value={userStatusLabel(auth.user.status)} />
      </dl>
    </section>
  )
}

export function AdminUsersPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page],
    enabled: auth.user?.role === 'admin',
    queryFn: () => auth.api.adminUsers({ page, pageSize: adminUsersPageSize }),
  })

  const updateUser = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminUpdateUserRequest }) =>
      auth.api.updateAdminUser(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.user.email}: пользователь обновлен`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Пользователи"
        title="Доступ запрещен"
        description="У аккаунта нет прав на управление пользователями."
      />
    )
  }

  const data = usersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminUsersPageSize))
  const mutationError = updateUser.error ? formatRequestError(updateUser.error) : null

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <AdminUsersPanel
        data={data}
        disabled={usersQuery.isFetching || updateUser.isPending}
        loadError={usersQuery.isError ? usersQuery.error : null}
        loading={usersQuery.isLoading}
        mutationError={mutationError}
        notice={notice}
        page={page}
        totalPages={totalPages}
        onNextPage={() => setPage((current) => current + 1)}
        onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
        onUpdateUser={(user, input) => {
          setNotice(null)
          updateUser.mutate({ id: user.id, input })
        }}
      />
    </section>
  )
}
