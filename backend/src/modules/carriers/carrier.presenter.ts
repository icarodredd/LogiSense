import type { Carrier } from '@prisma/client';

function toNumber(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const candidate = v as Record<string, unknown>;
  if (typeof candidate.toNumber === 'function') return candidate.toNumber();
  return Number(v);
}

export interface CarrierResponse {
  id: string;
  tenantId: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  baseFee: number;
  pricePerKg: number;
  pricePerKm: number;
  riskPercent: number;
  cubingFactor: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCarrierResponse(carrier: Carrier): CarrierResponse {
  return {
    id: carrier.id,
    tenantId: carrier.tenantId,
    name: carrier.name,
    document: carrier.document,
    email: carrier.email,
    phone: carrier.phone,
    baseFee: toNumber(carrier.baseFee),
    pricePerKg: toNumber(carrier.pricePerKg),
    pricePerKm: toNumber(carrier.pricePerKm),
    riskPercent: toNumber(carrier.riskPercent),
    cubingFactor: carrier.cubingFactor,
    active: carrier.active,
    createdAt: carrier.createdAt,
    updatedAt: carrier.updatedAt,
  };
}
