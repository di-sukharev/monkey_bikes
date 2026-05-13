import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminUpdateUserRequest } from '@web-app-demo/contracts'
import { ShieldCheckIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'

import { AuthForm } from '@/components/AuthForm'
import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { HomeSessionCard } from '@/components/home-session-card'
import { PageHeading } from '@/components/page-heading'
import { FactCard, GateCard, LoadingState } from '@/components/page-state'
import { Button } from '@/components/ui/button'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { AdminUsersPanel } from '@/features/admin/admin-users-panel'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { userRoleLabel, userStatusLabel } from '@/lib/user-labels'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const adminUsersPageSize = 20

export function RootLayout() {
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

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
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
        'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-center',
      )}
    >
      <PageHeading
        eyebrow="Маркетплейс велопроката"
        title="Аренда маленьких велосипедов для клиентов, производителей и администраторов."
        description="Выберите велосипеды в каталоге, создайте заявку на аренду и отслеживайте статусы, платежи и выдачу в одном веб-приложении."
        size="hero"
      />
      <AuthForm />
    </section>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Защищенный раздел"
        title="Нужен вход"
        description="Войдите в аккаунт, чтобы открыть профиль и рабочие разделы."
        action={
          <Button asChild>
            <Link to="/">К авторизации</Link>
          </Button>
        }
      />
    )
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
    return (
      <GateCard
        eyebrow="Пользователи"
        title="Нужен вход"
        description="Войдите под администратором, чтобы управлять пользователями."
        action={
          <Button asChild>
            <Link to="/">К авторизации</Link>
          </Button>
        }
      />
    )
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
