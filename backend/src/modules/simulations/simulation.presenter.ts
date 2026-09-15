import type {
  FreightSimulation,
  SimulationQuote,
  SimulationStatus as PrismaSimulationStatus,
} from '@prisma/client';

export interface SimulationQuoteResponse {
  id: string;
  carrierId: string;
  carrierName: string;
  freightCost: number;
  additionalFees: number;
  totalCost: number;
  estimatedDays: number | null;
  isCheapest: boolean;
  createdAt: Date;
}

export interface SimulationResponse {
  id: string;
  tenantId: string;
  userId: string | null;
  customerId: string | null;
  selectedCarrierId: string | null;
  origin: string;
  destination: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  cargoValue: number;
  distanceKm: number | null;
  volumetricWeightKg: number | null;
  chargeableWeightKg: number | null;
  status: PrismaSimulationStatus;
  quotes: SimulationQuoteResponse[];
  cheapestQuote: SimulationQuoteResponse | null;
  createdAt: Date;
}

function toNumber(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const candidate = v as Record<string, unknown>;
  if (typeof candidate.toNumber === 'function') return candidate.toNumber();
  return Number(v);
}

function toQuoteResponse(
  quote: SimulationQuote & { carrier: { id: string; name: string } },
): SimulationQuoteResponse {
  return {
    id: quote.id,
    carrierId: quote.carrierId,
    carrierName: quote.carrier.name,
    freightCost: toNumber(quote.freightCost),
    additionalFees: toNumber(quote.additionalFees),
    totalCost: toNumber(quote.totalCost),
    estimatedDays: quote.estimatedDays,
    isCheapest: quote.isCheapest,
    createdAt: quote.createdAt,
  };
}

export function toSimulationResponse(
  sim: FreightSimulation & {
    quotes: (SimulationQuote & { carrier: { id: string; name: string } })[];
  },
): SimulationResponse {
  const quotes = sim.quotes.map(toQuoteResponse);
  const cheapest = quotes.find((q) => q.isCheapest) ?? null;
  return {
    id: sim.id,
    tenantId: sim.tenantId,
    userId: sim.userId,
    customerId: sim.customerId,
    selectedCarrierId: sim.selectedCarrierId,
    origin: sim.origin,
    destination: sim.destination,
    weightKg: sim.weightKg,
    lengthCm: sim.lengthCm,
    widthCm: sim.widthCm,
    heightCm: sim.heightCm,
    cargoValue: toNumber(sim.cargoValue),
    distanceKm: sim.distanceKm,
    volumetricWeightKg: sim.volumetricWeightKg,
    chargeableWeightKg: sim.chargeableWeightKg,
    status: sim.status,
    quotes,
    cheapestQuote: cheapest,
    createdAt: sim.createdAt,
  };
}
