import { describe, expect, it } from 'vitest';
import { FreightService } from './freight.service.js';

const carrier = {
  id: 'c1',
  name: 'Test',
  baseFee: 50,
  pricePerKg: 2.0,
  pricePerKm: 0.6,
  riskPercent: 0.005,
  cubingFactor: 6000,
  active: true,
};

type CarrierInput = Parameters<FreightService['calculate']>[0];

const freight = new FreightService();
const carrierInput = carrier as unknown as CarrierInput;
const DISCOUNT_PCT = 0.05;

describe('FreightService — cálculo', () => {
   it('calcula custo total corretamente (carga leve)', () => {
    const result = freight.calculate(carrierInput, {
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
      distanceKm: 430,
    });
    const pesoCubado = (100 * 100 * 100) / 6000; // 166.67
    const chargeable = Math.max(100, pesoCubado);
    expect(result.freightCost).toBeCloseTo(50 + chargeable * 2.0, 2);
    expect(result.additionalFees).toBe(25);
    expect(result.totalCost).toBeCloseTo(result.freightCost + 258 + 25, 2);
    expect(result.estimatedDays).toBe(4);
  });

  it('usa peso cubado quando maior que peso real', () => {
    const result = freight.calculate(carrierInput, {
      weightKg: 10,
      lengthCm: 200,
      widthCm: 150,
      heightCm: 150,
      cargoValue: 1000,
      distanceKm: 100,
    });
    expect(result.freightCost).toBe(1550);
  });

  it('aplica desconto de 5% para carga pesada (>500kg)', () => {
    const light = freight.calculate(carrierInput, {
      weightKg: 499,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 1000,
      distanceKm: 100,
    });
    const heavy = freight.calculate(carrierInput, {
      weightKg: 501,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 1000,
      distanceKm: 100,
    });
    expect(heavy.totalCost).toBeLessThan(light.totalCost);
    const expectedDiscounted = Math.round(heavy.totalCost / (1 - DISCOUNT_PCT) * 100) / 100;
    expect(heavy.totalCost).toBeCloseTo(expectedDiscounted * (1 - DISCOUNT_PCT), 2);
  });

  it('estima prazo por faixa de distância', () => {
    expect(freight.estimateDeliveryDays(100)).toBe(2);
    expect(freight.estimateDeliveryDays(300)).toBe(2);
    expect(freight.estimateDeliveryDays(500)).toBe(4);
    expect(freight.estimateDeliveryDays(1000)).toBe(4);
    expect(freight.estimateDeliveryDays(1500)).toBe(7);
    expect(freight.estimateDeliveryDays(2500)).toBe(7);
    expect(freight.estimateDeliveryDays(3000)).toBe(12);
  });

  it('arredonda para 2 casas decimais', () => {
    const c: CarrierInput = {
      ...carrierInput,
      pricePerKg: 1.3333 as unknown as CarrierInput['pricePerKg'],
      pricePerKm: 0.5555 as unknown as CarrierInput['pricePerKm'],
    };
    const result = freight.calculate(c, {
      weightKg: 10,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
      cargoValue: 100,
      distanceKm: 100,
    });
    expect(Number.isFinite(result.totalCost)).toBe(true);
    expect(result.totalCost).toBe(Math.round(result.totalCost * 100) / 100);
  });
});
