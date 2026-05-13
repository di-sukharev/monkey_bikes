import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AdminUpdateUserRequest,
  type UserDto,
  type UserRole,
  type UserStatus,
} from '@web-app-demo/contracts'
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { useState } from 'react'

import { AuthForm } from '@/components/AuthForm'
import { AppSidebar } from '@/components/app-sidebar'
import { FactCard, GateCard, LoadingState } from '@/components/page-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const adminUsersPageSize = 20
const userRoles: UserRole[] = ['user', 'manufacturer', 'admin']
const userStatuses: UserStatus[] = ['active', 'blocked']

export function RootLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
          <SidebarTrigger aria-label="Открыть меню" className="-ml-1" />
          <div className="h-5 w-px bg-border md:hidden" aria-hidden="true" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight md:hidden"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
              BR
            </span>
            Велопрокат
          </Link>
        </header>
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
        <Card className="max-w-3xl">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Активная сессия
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Сессия активна
            </h1>
            <CardDescription className="text-base">
              Вы вошли как <strong className="text-foreground">{auth.user.email}</strong>.
              Базовая авторизация готова для рабочих сценариев.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/app">
                Открыть профиль
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
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
      <div className="grid gap-5">
        <Badge variant="outline" className="w-fit">
          Маркетплейс велопроката
        </Badge>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Аренда маленьких велосипедов для клиентов, производителей и администраторов.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Выберите велосипеды в каталоге, создайте заявку на аренду и отслеживайте статусы,
          платежи и выдачу в одном веб-приложении.
        </p>
      </div>
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
      <div className="grid gap-3">
        <Badge variant="secondary" className="w-fit">
          Текущий пользователь
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {auth.user.displayName ?? auth.user.email}
        </h1>
        <p className="text-muted-foreground">{auth.user.email}</p>
      </div>

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
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Пользователи
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Пользователи</h1>
            <CardDescription>Просматривайте аккаунты и централизованно меняйте роли и статусы.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {usersQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Загружаем пользователей...
            </div>
          )}

          {usersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить пользователей</AlertTitle>
              <AlertDescription>{formatRequestError(usersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Пользователь обновлен</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить пользователя</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersRoundIcon />
                </EmptyMedia>
                <EmptyTitle>Пользователи не найдены.</EmptyTitle>
                <EmptyDescription>Текущие фильтры не вернули аккаунты.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%]">Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Создан</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((user) => (
                    <AdminUserRow
                      key={user.id}
                      disabled={updateUser.isPending}
                      user={user}
                      onUpdate={(input) => {
                        setNotice(null)
                        updateUser.mutate({ id: user.id, input })
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || usersQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Назад
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || usersQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Далее
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}

function AdminUserRow({
  disabled,
  user,
  onUpdate,
}: {
  disabled: boolean
  user: UserDto
  onUpdate: (input: AdminUpdateUserRequest) => void
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="grid gap-1">
          <strong className="font-medium">{user.displayName ?? user.email}</strong>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label={`Роль для ${user.email}`}
          className="w-full min-w-36"
          disabled={disabled}
          size="default"
          value={user.role}
          onChange={(event) => {
            const role = event.target.value as UserRole
            if (role !== user.role) {
              onUpdate({ role })
            }
          }}
        >
          {userRoles.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {userRoleLabel(role)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label={`Статус для ${user.email}`}
          className="w-full min-w-32"
          disabled={disabled}
          size="default"
          value={user.status}
          onChange={(event) => {
            const status = event.target.value as UserStatus
            if (status !== user.status) {
              onUpdate({ status })
            }
          }}
        >
          {userStatuses.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {userStatusLabel(status)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</TableCell>
    </TableRow>
  )
}

function userRoleLabel(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'Администратор'
    case 'manufacturer':
      return 'Производитель'
    case 'user':
      return 'Клиент'
  }
}

function userStatusLabel(status: UserStatus) {
  switch (status) {
    case 'active':
      return 'Активен'
    case 'blocked':
      return 'Заблокирован'
  }
}
