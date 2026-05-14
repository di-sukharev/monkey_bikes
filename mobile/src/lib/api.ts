import {
  apiErrorSchema,
  authResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  orderCancelRequestSchema,
  orderCreateRequestSchema,
  orderResponseSchema,
  ordersQuerySchema,
  ordersResponseSchema,
  paymentResponseSchema,
  publicBicycleResponseSchema,
  publicBicyclesQuerySchema,
  publicBicyclesResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type LogoutRequest,
  type MeResponse,
  type OrderCancelInput,
  type OrderCreateInput,
  type OrderResponse,
  type OrdersQuery,
  type OrdersResponse,
  type PaymentResponse,
  type PaymentType,
  type PublicBicycleResponse,
  type PublicBicyclesQuery,
  type PublicBicyclesResponse,
  type RefreshResponse,
  type RegisterRequest,
} from '@web-app-demo/contracts';
import type { z } from 'zod';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:43180').replace(/\/$/, '');

type ApiClientOptions = {
  getAccessToken: () => string | null;
  setAccessToken: (accessToken: string | null) => void;
  getRefreshToken: () => Promise<string | null>;
  setRefreshToken: (refreshToken: string) => Promise<void>;
  clearRefreshToken: () => Promise<void>;
  onAuthExpired?: () => void | Promise<void>;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ApiClient {
  private refreshPromise: Promise<RefreshResponse> | null = null;

  constructor(private readonly options: ApiClientOptions) {}

  register(input: RegisterRequest): Promise<AuthResponse> {
    const payload = registerRequestSchema.parse(input);
    return this.request('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    });
  }

  login(input: LoginRequest): Promise<AuthResponse> {
    const payload = loginRequestSchema.parse(input);
    return this.request('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    });
  }

  async refresh(): Promise<RefreshResponse> {
    const refreshToken = await this.options.getRefreshToken();
    const payload = refreshRequestSchema.parse({ refreshToken: refreshToken ?? undefined });
    return this.request('/api/auth/refresh', refreshResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    });
  }

  me(): Promise<MeResponse> {
    return this.request('/api/auth/me', meResponseSchema, {
      auth: true,
    });
  }

  async logout(input: LogoutRequest = {}) {
    const storedRefreshToken = await this.options.getRefreshToken();
    const payload = logoutRequestSchema.parse({
      refreshToken: input.refreshToken ?? storedRefreshToken ?? undefined,
    });

    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    });
  }

  publicBicycles(input: Partial<PublicBicyclesQuery> = {}): Promise<PublicBicyclesResponse> {
    const query = publicBicyclesQuerySchema.parse(input);
    const params = paginatedParams(query.page, query.pageSize);

    if (query.sizes) {
      params.set('sizes', query.sizes.join(','));
    }

    if (query.minPriceKopecks !== undefined) {
      params.set('minPriceKopecks', String(query.minPriceKopecks));
    }

    if (query.maxPriceKopecks !== undefined) {
      params.set('maxPriceKopecks', String(query.maxPriceKopecks));
    }

    if (query.city) {
      params.set('city', query.city);
    }

    if (query.startsOn) {
      params.set('startsOn', query.startsOn);
    }

    if (query.endsOn) {
      params.set('endsOn', query.endsOn);
    }

    return this.request(`/api/bicycles?${params.toString()}`, publicBicyclesResponseSchema, {
      auth: false,
    });
  }

  publicBicycle(id: string): Promise<PublicBicycleResponse> {
    return this.request(`/api/bicycles/${encodeURIComponent(id)}`, publicBicycleResponseSchema, {
      auth: false,
    });
  }

  orders(input: Partial<OrdersQuery> = {}): Promise<OrdersResponse> {
    const query = ordersQuerySchema.parse(input);
    const params = paginatedParams(query.page, query.pageSize);

    if (query.status) {
      params.set('status', query.status);
    }

    if (query.scope !== 'all') {
      params.set('scope', query.scope);
    }

    return this.request(`/api/orders?${params.toString()}`, ordersResponseSchema, {
      auth: true,
    });
  }

  order(id: string): Promise<OrderResponse> {
    return this.request(`/api/orders/${encodeURIComponent(id)}`, orderResponseSchema, {
      auth: true,
    });
  }

  createOrder(input: OrderCreateInput): Promise<OrderResponse> {
    const payload = orderCreateRequestSchema.parse(input);
    return this.request('/api/orders', orderResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    });
  }

  cancelOrder(id: string, input: OrderCancelInput = {}): Promise<OrderResponse> {
    const payload = orderCancelRequestSchema.parse(input);
    return this.request(`/api/orders/${encodeURIComponent(id)}/cancel`, orderResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    });
  }

  createOrderPayment(id: string, type: PaymentType): Promise<PaymentResponse> {
    return this.request(
      `/api/orders/${encodeURIComponent(id)}/payments/${type}`,
      paymentResponseSchema,
      {
        method: 'POST',
        auth: true,
      },
    );
  }

  completeStubPayment(
    id: string,
    action: 'stub-cancel' | 'stub-fail' | 'stub-success',
  ): Promise<PaymentResponse> {
    return this.request(`/api/payments/${encodeURIComponent(id)}/${action}`, paymentResponseSchema, {
      method: 'POST',
      auth: true,
    });
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.infer<TSchema>> {
    const response = await this.rawRequest(path, options);
    const data = await response.json();
    return schema.parse(data);
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: this.headers(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 401 && options.auth && options.retryOnUnauthorized !== false) {
      const refreshed = await this.refreshOnce().catch(async (error: unknown) => {
        await this.expireSession();
        throw error;
      });
      this.options.setAccessToken(refreshed.accessToken);

      if (refreshed.refreshToken) {
        await this.options.setRefreshToken(refreshed.refreshToken);
      }

      return this.rawRequest(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    return response;
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async expireSession() {
    this.options.setAccessToken(null);
    await this.options.clearRefreshToken();
    await this.options.onAuthExpired?.();
  }

  private headers(options: RequestOptions) {
    const headers = new Headers({
      'X-Client-Platform': 'mobile',
    });

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.auth) {
      const accessToken = this.options.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    return headers;
  }
}

async function toApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`;

  try {
    const parsed = apiErrorSchema.parse(await response.json());
    return new ApiRequestError(response.status, parsed.error.code, parsed.error.message);
  } catch {
    return new ApiRequestError(response.status, 'INTERNAL_ERROR', fallbackMessage);
  }
}

function paginatedParams(page: number, pageSize: number) {
  return new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
}
