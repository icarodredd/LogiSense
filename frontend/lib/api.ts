const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
type Page<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };

type ApiError = { message?: string; code?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(error.message ?? "Não foi possível concluir a operação.");
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string, totpCode?: string) =>
    request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    }),
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
};
