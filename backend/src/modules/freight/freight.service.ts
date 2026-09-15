import { Injectable } from '@nestjs/common';
import type { Carrier } from '@prisma/client';

export interface FreightInput {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  cargoValue: number;
  distanceKm: number;
}

export interface FreightQuote {
  freightCost: number;
  additionalFees: number;
  totalCost: number;
  estimatedDays: number;
}

const WEIGHT_DISCOUNT_THRESHOLD_KG = 500;
const WEIGHT_DISCOUNT_PERCENT = 0.05;

const DAYS_BY_DISTANCE: Array<{ maxKm: number; days: number }> = [
  { maxKm: 300, days: 2 },
  { maxKm: 1000, days: 4 },
  { maxKm: 2500, days: 7 },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class FreightService {
  calculate(carrier: Carrier, input: FreightInput): FreightQuote {
    const baseFee = typeof carrier.baseFee === 'number' ? carrier.baseFee : carrier.baseFee.toNumber();
    const pricePerKg = typeof carrier.pricePerKg === 'number' ? carrier.pricePerKg : carrier.pricePerKg.toNumber();
    const pricePerKm = typeof carrier.pricePerKm === 'number' ? carrier.pricePerKm : carrier.pricePerKm.toNumber();
    const riskPercent = typeof carrier.riskPercent === 'number' ? carrier.riskPercent : carrier.riskPercent.toNumber();
    const cubingFactor = carrier.cubingFactor ?? 6000;

    const pesoCubado = (input.lengthCm * input.widthCm * input.heightCm) / cubingFactor;
    const chargeableWeight = Math.max(input.weightKg, pesoCubado);

    const freightCost = round2(baseFee + chargeableWeight * pricePerKg);
    const distanceCost = round2(input.distanceKm * pricePerKm);
    const riskCost = round2(input.cargoValue * riskPercent);

    let totalCost = round2(freightCost + distanceCost + riskCost);

    if (chargeableWeight > WEIGHT_DISCOUNT_THRESHOLD_KG) {
      totalCost = round2(totalCost * (1 - WEIGHT_DISCOUNT_PERCENT));
    }

    const estimatedDays = this.estimateDeliveryDays(input.distanceKm);

    return {
      freightCost,
      additionalFees: riskCost,
      totalCost,
      estimatedDays,
    };
  }

  estimateDeliveryDays(distanceKm: number): number {
    for (const tier of DAYS_BY_DISTANCE) {
      if (distanceKm <= tier.maxKm) return tier.days;
    }
    return 12;
  }
}
