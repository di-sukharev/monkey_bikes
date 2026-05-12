import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUpdateUserRequest, UserDto, UserRole, UserStatus } from '@web-app-demo/contracts'
import { useState } from 'react'

import { AuthForm } from './components/AuthForm'
import { ApiRequestError } from './lib/api'
import { useAuth } from './lib/use-auth'

const adminUsersPageSize = 20
const userRoles: UserRole[] = ['user', 'manufacturer', 'admin']
const userStatuses: UserStatus[] = ['active', 'blocked']

export function RootLayout() {
  const auth = useAuth()

  return (
    <main className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          web_app_demo
        </Link>
        <nav>
          <Link to="/" activeProps={{ className: 'active' }}>
            Auth
          </Link>
          <Link to="/app" activeProps={{ className: 'active' }}>
            App
          </Link>
          {auth.user?.role === 'admin' && (
            <Link to="/admin/users" activeProps={{ className: 'active' }}>
              Admin
            </Link>
          )}
        </nav>
        {auth.isAuthenticated && (
          <button type="button" className="ghost-action" onClick={() => void auth.logout()}>
            Logout
          </button>
        )}
      </header>
      <Outlet />
    </main>
  )
}

export function HomePage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <p className="status">Checking session...</p>
  }

  if (auth.user) {
    return (
      <section className="hero">
        <p className="eyebrow">Authenticated starter</p>
        <h1>Session is active</h1>
        <p>
          Logged in as <strong>{auth.user.email}</strong>. This is the baseline auth pattern for
          future web features.
        </p>
        <Link to="/app" className="primary-link">
          Open app
        </Link>
      </section>
    )
  }

  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <p className="eyebrow">Golden path template</p>
        <h1>Auth, validation, API state, and forms are wired from day one.</h1>
        <p>
          The web app uses shared Zod contracts, TanStack Query for server state, TanStack Form for
          input state, and an API client that refreshes sessions through the backend.
        </p>
      </div>
      <AuthForm />
    </section>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <p className="status">Checking session...</p>
  }

  if (!auth.user) {
    return (
      <section className="hero">
        <p className="eyebrow">Protected example</p>
        <h1>Login required</h1>
        <p>This route intentionally stays small and shows where protected product UI begins.</p>
        <Link to="/" className="primary-link">
          Go to auth
        </Link>
      </section>
    )
  }

  return (
    <section className="dashboard">
      <div>
        <p className="eyebrow">Current user</p>
        <h1>{auth.user.displayName ?? auth.user.email}</h1>
        <p>{auth.user.email}</p>
      </div>
      <dl className="facts">
        <div>
          <dt>User ID</dt>
          <dd>{auth.user.id}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(auth.user.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{auth.user.role}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{auth.user.status}</dd>
        </div>
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
      setNotice(`${response.user.email} updated`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  if (auth.isBootstrapping) {
    return <p className="status">Checking session...</p>
  }

  if (!auth.user) {
    return (
      <section className="hero">
        <p className="eyebrow">Admin users</p>
        <h1>Login required</h1>
        <p>Sign in with an administrator account to manage users.</p>
        <Link to="/" className="primary-link">
          Go to auth
        </Link>
      </section>
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <section className="hero">
        <p className="eyebrow">Admin users</p>
        <h1>Access denied</h1>
        <p>Your account does not have permission to manage users.</p>
      </section>
    )
  }

  const data = usersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminUsersPageSize))
  const mutationError = updateUser.error ? formatMutationError(updateUser.error) : null

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Admin users</p>
          <h1>Users</h1>
        </div>
        {data && (
          <p className="admin-count">
            {data.total} total, page {data.page} of {totalPages}
          </p>
        )}
      </div>

      {usersQuery.isLoading && <p className="status-block">Loading users...</p>}
      {usersQuery.isError && (
        <p className="form-error">{formatMutationError(usersQuery.error)}</p>
      )}
      {notice && <p className="success-message">{notice}</p>}
      {mutationError && <p className="form-error">{mutationError}</p>}

      {data && data.items.length === 0 && <p className="status-block">No users found.</p>}
      {data && data.items.length > 0 && (
        <div className="table-shell">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
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
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button
          type="button"
          className="ghost-action"
          disabled={page <= 1 || usersQuery.isFetching}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="ghost-action"
          disabled={page >= totalPages || usersQuery.isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>
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
    <tr>
      <td>
        <div className="user-cell">
          <strong>{user.displayName ?? user.email}</strong>
          <span>{user.email}</span>
        </div>
      </td>
      <td>
        <select
          aria-label={`Role for ${user.email}`}
          disabled={disabled}
          value={user.role}
          onChange={(event) => {
            const role = event.target.value as UserRole
            if (role !== user.role) {
              onUpdate({ role })
            }
          }}
        >
          {userRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          aria-label={`Status for ${user.email}`}
          disabled={disabled}
          value={user.status}
          onChange={(event) => {
            const status = event.target.value as UserStatus
            if (status !== user.status) {
              onUpdate({ status })
            }
          }}
        >
          {userStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
    </tr>
  )
}

function formatMutationError(error: unknown) {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return 'Unexpected request error'
}
