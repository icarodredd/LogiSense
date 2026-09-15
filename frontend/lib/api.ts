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
export type AuthTenant = { id: string; name: string; slug: string };
type CachedSession = { user: AuthUser; tenant: AuthTenant };
export type ManagedUser = AuthUser & { status: "ACTIVE" | "SUSPENDED"; mfaEnabled: boolean; createdAt: string; updatedAt: string };
export type AuditLog = { id: string; action: string; entity: string; entityId: string | null; metadata: Record<string, unknown> | null; ip: string | null; createdAt: string; user: { id: string; name: string; email: string } | null };

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
export type ImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ImportType = "CUSTOMERS" | "CARRIERS" | "SIMULATIONS";
export type ImportRecord = {
  id: string;
  tenantId: string;
  userId: string | null;
  filename: string;
  type: ImportType;
  sizeBytes: number;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type Insight = {
  id: string;
  type: "economy" | "carrier" | "concentration" | "trend" | string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
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
const SESSION_CACHE_KEY = "logisense.session";

function readCachedSession(): CachedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    return value ? JSON.parse(value) as CachedSession : null;
  } catch {
    return null;
  }
}

function writeCachedSession(session: CachedSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
}

function clearCachedSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_CACHE_KEY);
}

async function request<T>(path: string, init?: RequestInit, canRefresh = true): Promise<T> {
  let response: Response;
  try {
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
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

async function upload<T>(path: string, body: FormData, canRefresh = true): Promise<T> {
  return request<T>(path, { method: "POST", body }, canRefresh);
}

export const api = {
  login: async (email: string, password: string, totpCode?: string) => {
    const result = await request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    });
    writeCachedSession({ user: result.user, tenant: readCachedSession()?.tenant ?? { id: result.user.tenantId, name: "Workspace", slug: "" } });
    return result;
  },
  register: async (data: { tenantName: string; name: string; email: string; password: string }) => {
    const result = await request<{ user: AuthUser; tenant: AuthTenant }>("/auth/register", { method: "POST", body: JSON.stringify(data) });
    writeCachedSession(result);
    return result;
  },
  me: async () => {
    const result = await request<{ user: AuthUser; tenant: AuthTenant }>("/auth/me");
    writeCachedSession(result);
    return result;
  },
  logout: async () => {
    try {
      return await request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } finally {
      clearCachedSession();
    }
  },
  cachedSession: readCachedSession,
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
  imports: (params = "") => request<Page<ImportRecord> | { items: ImportRecord[]; total: number; page: number; limit: number }>(`/imports?limit=20${params}`),
  import: (id: string) => request<ImportRecord>(`/imports/${id}`),
  uploadImport: (file: File, type: ImportType) => {
    const body = new FormData();
    body.append("file", file);
    body.append("type", type);
    return upload<ImportRecord>("/imports", body);
  },
  retryImport: (id: string) => request<ImportRecord>(`/imports/${id}/retry`, { method: "POST" }),
  insights: () => request<Insight[]>("/insights"),
  regenerateInsights: () => request<Insight[]>("/insights/regenerate", { method: "POST" }),
  users: (params = "") => request<Page<ManagedUser>>(`/users?limit=20${params}`),
  createUser: (data: { name: string; email: string; password: string; role?: ManagedUser["role"] }) => request<ManagedUser>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<Pick<ManagedUser, "name" | "role" | "status">>) => request<ManagedUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  audit: (params = "") => request<Page<AuditLog>>(`/audit?limit=20${params}`),
  mfaSetup: () => request<{ otpauthUri: string; qrCodeDataUri: string; secret: string }>("/auth/mfa/setup", { method: "POST" }),
  mfaConfirm: (totpCode: string) => request<{ mfaEnabled: true }>("/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ totpCode }) }),
  mfaDisable: (password: string, totpCode: string) => request<{ mfaEnabled: false }>("/auth/mfa/disable", { method: "POST", body: JSON.stringify({ password, totpCode }) }),
};
