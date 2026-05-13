import type { UserRole, UserStatus } from '@web-app-demo/contracts'

export const userRoles: UserRole[] = ['user', 'manufacturer', 'admin']
export const userStatuses: UserStatus[] = ['active', 'blocked']

export function userRoleLabel(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'Администратор'
    case 'manufacturer':
      return 'Производитель'
    case 'user':
      return 'Клиент'
  }
}

export function userStatusLabel(status: UserStatus) {
  switch (status) {
    case 'active':
      return 'Активен'
    case 'blocked':
      return 'Заблокирован'
  }
}
