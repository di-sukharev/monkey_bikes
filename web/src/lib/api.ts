import {
  adminOrderResponseSchema,
  adminOrdersQuerySchema,
  adminOrdersResponseSchema,
  adminOrderStatusUpdateRequestSchema,
  apiErrorSchema,
  adminBicycleModerationRequestSchema,
  adminBicycleResponseSchema,
  adminBicyclesQuerySchema,
  adminBicyclesResponseSchema,
  adminBicycleStatusUpdateRequestSchema,
  adminManufacturerStatusUpdateResponseSchema,
  adminManufacturerStatusUpdateRequestSchema,
  adminManufacturersQuerySchema,
  adminManufacturersResponseSchema,
  adminUpdateUserRequestSchema,
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  bicycleResponseSchema,
  bicycleUpsertRequestSchema,
  type AdminManufacturerStatusUpdateRequest,
  type AdminManufacturersQuery,
  type AdminManufacturersResponse,
  type AdminBicycleModerationRequest,
  type AdminBicycleResponse,
  type AdminBicyclesQuery,
  type AdminBicyclesResponse,
  type AdminBicycleStatusUpdateRequest,
  type AdminUpdateUserRequest,
  type AdminUserResponse,
  type AdminUsersQuery,
  type AdminUsersResponse,
  authResponseSchema,
  type BicycleResponse,
  type BicycleUpsertInput,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  orderCreateRequestSchema,
  orderCancelRequestSchema,
  orderResponseSchema,
  ordersQuerySchema,
  ordersResponseSchema,
  type AdminOrderResponse,
  type AdminOrdersQuery,
  type AdminOrdersResponse,
  type AdminOrderStatusUpdateInput,
  type OrderCreateInput,
  type OrderCancelInput,
  type OrderResponse,
  type OrdersQuery,
  type OrdersResponse,
  manufacturerBicyclesQuerySchema,
  manufacturerBicyclesResponseSchema,
  manufacturerProfileGetResponseSchema,
  manufacturerProfileResponseSchema,
  manufacturerProfileSubmitResponseSchema,
  manufacturerProfileUpsertRequestSchema,
  type ManufacturerBicyclesQuery,
  type ManufacturerBicyclesResponse,
  type ManufacturerProfileGetResponse,
  type ManufacturerProfileResponse,
  type ManufacturerProfileSubmitResponse,
  type ManufacturerProfileUpsertRequest,
  publicBicycleResponseSchema,
  publicBicyclesQuerySchema,
  publicBicyclesResponseSchema,
  type PublicBicycleResponse,
  type PublicBicyclesQuery,
  type PublicBicyclesResponse,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type LogoutRequest,
  type MeResponse,
  type RefreshRequest,
  type RefreshResponse,
  type RegisterRequest,
} from '@web-app-demo/contracts'
import type { z } from 'zod'

const apiBaseUrl = (import.meta.env?.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type ApiClientOptions = {
  getAccessToken: () => string | null
  setAccessToken: (accessToken: string | null) => void
  onAuthExpired?: () => void | Promise<void>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  body?: unknown
  auth?: boolean
  retryOnUnauthorized?: boolean
  accessTokenOverride?: string
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export class ApiClient {
  private readonly options: ApiClientOptions
  private refreshPromise: Promise<RefreshResponse> | null = null

  constructor(options: ApiClientOptions) {
    this.options = options
  }

  register(input: RegisterRequest): Promise<AuthResponse> {
    const payload = registerRequestSchema.parse(input)
    return this.request('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  login(input: LoginRequest): Promise<AuthResponse> {
    const payload = loginRequestSchema.parse(input)
    return this.request('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  refresh(input: RefreshRequest = {}): Promise<RefreshResponse> {
    const payload = refreshRequestSchema.parse(input)
    return this.request('/api/auth/refresh', refreshResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  me(): Promise<MeResponse> {
    return this.request('/api/auth/me', meResponseSchema, {
      auth: true,
    })
  }

  adminUsers(input: Partial<AdminUsersQuery> = {}): Promise<AdminUsersResponse> {
    const query = adminUsersQuerySchema.parse(input)
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    })

    if (query.role) {
      params.set('role', query.role)
    }

    if (query.status) {
      params.set('status', query.status)
    }

    return this.request(`/api/admin/users?${params.toString()}`, adminUsersResponseSchema, {
      auth: true,
    })
  }

  adminUser(id: string): Promise<AdminUserResponse> {
    return this.request(`/api/admin/users/${encodeURIComponent(id)}`, adminUserResponseSchema, {
      auth: true,
    })
  }

  updateAdminUser(id: string, input: AdminUpdateUserRequest): Promise<AdminUserResponse> {
    const payload = adminUpdateUserRequestSchema.parse(input)
    return this.request(`/api/admin/users/${encodeURIComponent(id)}`, adminUserResponseSchema, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  }

  manufacturerProfile(): Promise<ManufacturerProfileGetResponse> {
    return this.request('/api/manufacturer/profile', manufacturerProfileGetResponseSchema, {
      auth: true,
    })
  }

  upsertManufacturerProfile(
    input: ManufacturerProfileUpsertRequest,
  ): Promise<ManufacturerProfileResponse> {
    const payload = manufacturerProfileUpsertRequestSchema.parse(input)
    return this.request('/api/manufacturer/profile', manufacturerProfileResponseSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  submitManufacturerProfile(): Promise<ManufacturerProfileSubmitResponse> {
    return this.request(
      '/api/manufacturer/profile/submit',
      manufacturerProfileSubmitResponseSchema,
      {
        method: 'POST',
        auth: true,
      },
    )
  }

  adminManufacturers(
    input: Partial<AdminManufacturersQuery> = {},
  ): Promise<AdminManufacturersResponse> {
    const query = adminManufacturersQuerySchema.parse(input)
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    })

    if (query.status) {
      params.set('status', query.status)
    }

    return this.request(
      `/api/admin/manufacturers?${params.toString()}`,
      adminManufacturersResponseSchema,
      {
        auth: true,
      },
    )
  }

  updateAdminManufacturerStatus(id: string, input: AdminManufacturerStatusUpdateRequest) {
    const payload = adminManufacturerStatusUpdateRequestSchema.parse(input)
    const body =
      payload.moderationComment === null
        ? { status: payload.status }
        : payload

    return this.request(
      `/api/admin/manufacturers/${encodeURIComponent(id)}/status`,
      adminManufacturerStatusUpdateResponseSchema,
      {
        method: 'PATCH',
        body,
        auth: true,
      },
    )
  }

  publicBicycles(input: Partial<PublicBicyclesQuery> = {}): Promise<PublicBicyclesResponse> {
    const query = publicBicyclesQuerySchema.parse(input)
    const params = paginatedParams(query.page, query.pageSize)

    if (query.sizes) {
      params.set('sizes', query.sizes.join(','))
    }

    if (query.minPriceKopecks !== undefined) {
      params.set('minPriceKopecks', String(query.minPriceKopecks))
    }

    if (query.maxPriceKopecks !== undefined) {
      params.set('maxPriceKopecks', String(query.maxPriceKopecks))
    }

    if (query.city) {
      params.set('city', query.city)
    }

    if (query.startsOn) {
      params.set('startsOn', query.startsOn)
    }

    if (query.endsOn) {
      params.set('endsOn', query.endsOn)
    }

    return this.request(`/api/bicycles?${params.toString()}`, publicBicyclesResponseSchema, {
      auth: false,
    })
  }

  publicBicycle(id: string): Promise<PublicBicycleResponse> {
    return this.request(`/api/bicycles/${encodeURIComponent(id)}`, publicBicycleResponseSchema, {
      auth: false,
    })
  }

  manufacturerBicycles(
    input: Partial<ManufacturerBicyclesQuery> = {},
  ): Promise<ManufacturerBicyclesResponse> {
    const query = manufacturerBicyclesQuerySchema.parse(input)
    const params = paginatedParams(query.page, query.pageSize)

    if (query.status) {
      params.set('status', query.status)
    }

    return this.request(
      `/api/manufacturer/bicycles?${params.toString()}`,
      manufacturerBicyclesResponseSchema,
      {
        auth: true,
      },
    )
  }

  createManufacturerBicycle(input: BicycleUpsertInput): Promise<BicycleResponse> {
    const payload = bicycleUpsertRequestSchema.parse(input)
    return this.request('/api/manufacturer/bicycles', bicycleResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  updateManufacturerBicycle(id: string, input: BicycleUpsertInput): Promise<BicycleResponse> {
    const payload = bicycleUpsertRequestSchema.parse(input)
    return this.request(`/api/manufacturer/bicycles/${encodeURIComponent(id)}`, bicycleResponseSchema, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  }

  submitManufacturerBicycle(id: string): Promise<BicycleResponse> {
    return this.request(
      `/api/manufacturer/bicycles/${encodeURIComponent(id)}/submit`,
      bicycleResponseSchema,
      {
        method: 'POST',
        auth: true,
      },
    )
  }

  orders(input: Partial<OrdersQuery> = {}): Promise<OrdersResponse> {
    const query = ordersQuerySchema.parse(input)
    const params = paginatedParams(query.page, query.pageSize)

    if (query.status) {
      params.set('status', query.status)
    }

    return this.request(`/api/orders?${params.toString()}`, ordersResponseSchema, {
      auth: true,
    })
  }

  order(id: string): Promise<OrderResponse> {
    return this.request(`/api/orders/${encodeURIComponent(id)}`, orderResponseSchema, {
      auth: true,
    })
  }

  createOrder(input: OrderCreateInput): Promise<OrderResponse> {
    const payload = orderCreateRequestSchema.parse(input)
    return this.request('/api/orders', orderResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  cancelOrder(id: string, input: OrderCancelInput = {}): Promise<OrderResponse> {
    const payload = orderCancelRequestSchema.parse(input)
    return this.request(`/api/orders/${encodeURIComponent(id)}/cancel`, orderResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  adminOrders(input: Partial<AdminOrdersQuery> = {}): Promise<AdminOrdersResponse> {
    const query = adminOrdersQuerySchema.parse(input)
    const params = paginatedParams(query.page, query.pageSize)

    if (query.status) {
      params.set('status', query.status)
    }

    return this.request(`/api/admin/orders?${params.toString()}`, adminOrdersResponseSchema, {
      auth: true,
    })
  }

  adminOrder(id: string): Promise<AdminOrderResponse> {
    return this.request(`/api/admin/orders/${encodeURIComponent(id)}`, adminOrderResponseSchema, {
      auth: true,
    })
  }

  updateAdminOrderStatus(
    id: string,
    input: AdminOrderStatusUpdateInput,
  ): Promise<AdminOrderResponse> {
    const payload = adminOrderStatusUpdateRequestSchema.parse(input)
    return this.request(
      `/api/admin/orders/${encodeURIComponent(id)}/status`,
      adminOrderResponseSchema,
      {
        method: 'PATCH',
        body: payload,
        auth: true,
      },
    )
  }

  adminBicycles(input: Partial<AdminBicyclesQuery> = {}): Promise<AdminBicyclesResponse> {
    const query = adminBicyclesQuerySchema.parse(input)
    const params = paginatedParams(query.page, query.pageSize)

    if (query.status) {
      params.set('status', query.status)
    }

    if (query.size) {
      params.set('size', query.size)
    }

    return this.request(`/api/admin/bicycles?${params.toString()}`, adminBicyclesResponseSchema, {
      auth: true,
    })
  }

  moderateAdminBicycle(
    id: string,
    input: AdminBicycleModerationRequest,
  ): Promise<AdminBicycleResponse> {
    const payload = adminBicycleModerationRequestSchema.parse(input)
    const body =
      payload.moderationComment === null
        ? { decision: payload.decision }
        : payload

    return this.request(
      `/api/admin/bicycles/${encodeURIComponent(id)}/moderation`,
      adminBicycleResponseSchema,
      {
        method: 'PATCH',
        body,
        auth: true,
      },
    )
  }

  updateAdminBicycleStatus(
    id: string,
    input: AdminBicycleStatusUpdateRequest,
  ): Promise<AdminBicycleResponse> {
    const payload = adminBicycleStatusUpdateRequestSchema.parse(input)
    return this.request(
      `/api/admin/bicycles/${encodeURIComponent(id)}/status`,
      adminBicycleResponseSchema,
      {
        method: 'PATCH',
        body: payload,
        auth: true,
      },
    )
  }

  async logout(input: LogoutRequest = {}) {
    const payload = logoutRequestSchema.parse(input)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  async expireSession() {
    this.options.setAccessToken(null)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: {},
      auth: false,
      retryOnUnauthorized: false,
    }).catch(() => undefined)
    await this.options.onAuthExpired?.()
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.infer<TSchema>> {
    const response = await this.rawRequest(path, options)
    const data = await response.json()
    return schema.parse(data)
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: this.headers(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (response.status === 401 && options.auth && options.retryOnUnauthorized !== false) {
      const refreshed = await this.refreshOnce().catch(async (error: unknown) => {
        await this.expireSession()
        throw error
      })
      this.options.setAccessToken(refreshed.accessToken)
      return this.rawRequest(path, {
        ...options,
        accessTokenOverride: refreshed.accessToken,
        retryOnUnauthorized: false,
      })
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    return response
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  private headers(options: RequestOptions) {
    const headers = new Headers({
      'X-Client-Platform': 'web',
    })

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (options.auth) {
      const accessToken = options.accessTokenOverride ?? this.options.getAccessToken()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
    }

    return headers
  }
}

function paginatedParams(page: number, pageSize: number) {
  return new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
}

async function toApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`

  try {
    const parsed = apiErrorSchema.parse(await response.json())
    return new ApiRequestError(
      response.status,
      parsed.error.code,
      parsed.error.message,
      parsed.error.details,
    )
  } catch {
    return new ApiRequestError(response.status, 'INTERNAL_ERROR', fallbackMessage)
  }
}
