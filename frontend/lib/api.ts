const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_URL = API_BASE_URL.replace(/\/$/, "").endsWith("/api")
  ? API_BASE_URL.replace(/\/$/, "")
  : `${API_BASE_URL.replace(/\/$/, "")}/api`;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR";
  tenantId: string;
};

export type DashboardOverview = {
  totalSimulations: number;
  avgFreight: number;
  minFreight: number;
  maxFreight: number;
  potentialSavings: number;
  carriersUsed: number;
  topRoutes: { origin: string; destination: string; count: number }[];
  trendWeekly: { week: string; avgCost: number }[];
};

export type DashboardCarrier = {
  carrierId: string;
  carrierName: string;
  avgCost: number;
  totalCost: number;
  simulationCount: number;
};

export type DashboardRoute = {
  origin: string;
  destination: string;
  count: number;
  avgCost: number;
};

export type Customer = {
  id: string; name: string; document: string | null; email: string | null;
  phone: string | null; city: string | null; state: string | null; status: "ACTIVE" | "INACTIVE";
};
export type Carrier = {
  id: string; name: string; document: string | null; email: string | null; phone: string | null;
  baseFee: number; pricePerKg: number; pricePerKm: number; riskPercent: number; active: boolean;
};
export type SimulationQuote = {
  id: string; carrierId: string; carrierName: string; freightCost: number;
  additionalFees: number; totalCost: number; estimatedDays: number | null; isCheapest: boolean;
};
export type Simulation = {
  id: string; origin: string; destination: string; weightKg: number; lengthCm?: number;
  widthCm?: number; heightCm?: number; cargoValue: number; distanceKm: number | null;
  volumetricWeightKg?: number | null; chargeableWeightKg?: number | null;
  status: string; quotes: SimulationQuote[]; cheapestQuote: SimulationQuote | null;
  customer?: { id: string; name: string } | null; user?: { id: string; name: string } | null;
  potentialSavings?: number; createdAt: string;
};
type Page<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly fieldErrors: string[];

  constructor(input: { statusCode: number; code?: string; message?: string | string[]; requestId?: string | null }) {
    const message = Array.isArray(input.message) ? input.message.join(" ") : input.message;
    super(message ?? "Não foi possível concluir a operação.");
    this.name = "ApiError";
    this.statusCode = input.statusCode;
    this.code = input.code ?? "ERROR";
    this.requestId = input.requestId ?? null;
    this.fieldErrors = Array.isArray(input.message) ? input.message : [];
  }
}

function isPublicAuthPath(path: string) {
  return path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh") || path.startsWith("/auth/logout");
}

let refreshPromise: Promise<unknown> | null = null;

async function request<T>(path: string, init?: RequestInit, canRefresh = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError({ statusCode: 0, code: "API_UNAVAILABLE", message: "Não foi possível conectar ao servidor. Tente novamente." });
  }
  if (response.status === 401 && canRefresh && !isPublicAuthPath(path)) {
    try {
      refreshPromise ??= request("/auth/refresh", { method: "POST" }, false).finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return request<T>(path, init, false);
    } catch {
      throw new ApiError({ statusCode: 401, code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente." });
    }
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { statusCode?: number; code?: string; message?: string | string[]; requestId?: string | null };
    throw new ApiError({ statusCode: error.statusCode ?? response.status, code: error.code, message: error.message, requestId: error.requestId });
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string, totpCode?: string) =>
    request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    }),
  register: (data: { tenantName: string; name: string; email: string; password: string }) =>
    request<{ user: AuthUser; tenant: { id: string; name: string; slug: string } }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => request<{ user: AuthUser; tenant: { id: string; name: string; slug: string } }>("/auth/me"),
  logout: () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }),
  overview: () => request<DashboardOverview>("/dashboard/overview"),
  carriers: () => request<DashboardCarrier[]>("/dashboard/carriers"),
  routes: () => request<DashboardRoute[]>("/dashboard/routes"),
  customers: (params = "") => request<Page<Customer>>(`/customers?limit=20${params}`),
  createCustomer: (data: Record<string, unknown>) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Record<string, unknown>) => request<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  carriersList: (params = "") => request<Page<Carrier>>(`/carriers?limit=20${params}`),
  createCarrier: (data: Record<string, unknown>) => request<Carrier>("/carriers", { method: "POST", body: JSON.stringify(data) }),
  updateCarrier: (id: string, data: Record<string, unknown>) => request<Carrier>(`/carriers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCarrier: (id: string) => request<void>(`/carriers/${id}`, { method: "DELETE" }),
  simulations: (params = "") => request<Page<Simulation>>(`/simulations?limit=20${params}`),
  history: (params = "") => request<{ items: Simulation[]; total: number; page: number; limit: number }>(`/simulations/history?limit=20${params}`),
  simulation: (id: string) => request<Simulation>(`/simulations/${id}`),
  createSimulation: (data: Record<string, unknown>) => request<Simulation>("/simulations", { method: "POST", body: JSON.stringify(data) }),
};
