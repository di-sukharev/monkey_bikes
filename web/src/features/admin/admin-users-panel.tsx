import type {
  AdminUpdateUserRequest,
  AdminUsersResponse,
  UserDto,
  UserRole,
  UserStatus,
} from '@web-app-demo/contracts'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  UsersRoundIcon,
} from 'lucide-react'

import { PageHeading } from '@/components/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/components/ui/table'
import { formatRequestError } from '@/lib/request-error'
import { userRoleLabel, userRoles, userStatusLabel, userStatuses } from '@/lib/user-labels'

type AdminUsersPanelProps = {
  data: AdminUsersResponse | undefined
  disabled: boolean
  loadError: unknown | null
  loading: boolean
  mutationError: string | null
  notice: string | null
  page: number
  totalPages: number
  onNextPage: () => void
  onPreviousPage: () => void
  onUpdateUser: (user: UserDto, input: AdminUpdateUserRequest) => void
}

export function AdminUsersPanel({
  data,
  disabled,
  loadError,
  loading,
  mutationError,
  notice,
  page,
  totalPages,
  onNextPage,
  onPreviousPage,
  onUpdateUser,
}: AdminUsersPanelProps) {
  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <PageHeading
            eyebrow="Пользователи"
            title="Пользователи"
            description="Просматривайте аккаунты и централизованно меняйте роли и статусы."
          />
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {loading && (
            <TableSkeleton
              columnClassNames={['w-[42%]', '', '', '']}
              columns={4}
              label="Загружаем пользователей..."
              tableClassName="min-w-[760px]"
            />
          )}

          {loadError !== null && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить пользователей</AlertTitle>
              <AlertDescription>{formatRequestError(loadError)}</AlertDescription>
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

          {data && data.items.length === 0 && <AdminUsersEmptyState />}

          {data && data.items.length > 0 && (
            <AdminUsersTable
              disabled={disabled}
              users={data.items}
              onUpdateUser={onUpdateUser}
            />
          )}
        </CardContent>
      </Card>

      <AdminUsersPagination
        disabled={disabled}
        page={page}
        totalPages={totalPages}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      />
    </>
  )
}

function AdminUsersEmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersRoundIcon />
        </EmptyMedia>
        <EmptyTitle>Пользователи не найдены.</EmptyTitle>
        <EmptyDescription>Текущие фильтры не вернули аккаунты.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function AdminUsersTable({
  disabled,
  users,
  onUpdateUser,
}: {
  disabled: boolean
  users: UserDto[]
  onUpdateUser: (user: UserDto, input: AdminUpdateUserRequest) => void
}) {
  return (
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
          {users.map((user) => (
            <AdminUserRow
              key={user.id}
              disabled={disabled}
              user={user}
              onUpdate={(input) => onUpdateUser(user, input)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
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
        <div className="min-w-36">
          <NativeSelect
            aria-label={`Роль для ${user.email}`}
            disabled={disabled}
            fullWidth
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
        </div>
      </TableCell>
      <TableCell>
        <div className="min-w-32">
          <NativeSelect
            aria-label={`Статус для ${user.email}`}
            disabled={disabled}
            fullWidth
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
        </div>
      </TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</TableCell>
    </TableRow>
  )
}

function AdminUsersPagination({
  disabled,
  page,
  totalPages,
  onNextPage,
  onPreviousPage,
}: {
  disabled: boolean
  page: number
  totalPages: number
  onNextPage: () => void
  onPreviousPage: () => void
}) {
  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || disabled}
            onClick={onPreviousPage}
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
            disabled={page >= totalPages || disabled}
            onClick={onNextPage}
          >
            Далее
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
