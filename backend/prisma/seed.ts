/**
 * Seed de demonstração da LogiSense.
 *
 * Cria 2 tenants (o segundo existe para demonstrar isolamento de dados),
 * usuários (admin/managers/operators), clientes, transportadoras e
 * ~130 simulações com cotações — dados suficientes para dashboard e insights.
 *
 * Login demo (senha de todos): `Senha123!`
 *   - admin@acme.logisense.local (ADMIN do tenant principal)
 *   - admin@beta.logisense.local (ADMIN do segundo tenant)
 *
 * Fórmula de frete (conceito do AGENTS.md §9; o serviço de domínio da fase
 * de simulações deve implementar a MESMA regra):
 *   pesoCubado  = L * W * H / fatorCubagem
 *   pesoCobrado = max(pesoReal, pesoCubado)
 *   total = taxaBase + pesoCobrado * precoPorKg
 *         + distanciaKm * precoPorKm + valorCarga * percentualRisco
 *
 * Distâncias são aproximações rodoviárias para fins de demonstração.
 */
import { randomUUID } from 'node:crypto';
import prismaClient from '@prisma/client';
import bcrypt from 'bcryptjs';

const { PrismaClient } = prismaClient;
const prisma = new PrismaClient();
const DEMO_PASSWORD_HASH = bcrypt.hashSync('Senha123!', 10);

// PRNG determinístico: o seed sempre gera os mesmos dados demo.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];
const round2 = (value: number) => Math.round(value * 100) / 100;

const DISTANCES_KM: Record<string, number> = {
  'São Paulo|Fortaleza': 3100,
  'São Paulo|Recife': 2670,
  'São Paulo|Rio de Janeiro': 430,
  'São Paulo|Belo Horizonte': 585,
  'São Paulo|Porto Alegre': 1130,
  'São Paulo|Curitiba': 410,
  'São Paulo|Salvador': 1970,
  'São Paulo|Brasília': 1015,
  'São Paulo|Manaus': 3950,
  'Rio de Janeiro|Salvador': 1650,
  'Curitiba|Porto Alegre': 710,
  'Belo Horizonte|Brasília': 740,
};

const ROUTES = Object.keys(DISTANCES_KM).map((key) => {
  const [origin, destination] = key.split('|') as [string, string];
  // Rota SP -> Fortaleza representa ~21% das simulações (insight de concentração).
  const weight = key === 'São Paulo|Fortaleza' ? 21 : 7;
  return { origin, destination, distanceKm: DISTANCES_KM[key]!, weight };
});

function pickRoute() {
  const total = ROUTES.reduce((sum, route) => sum + route.weight, 0);
  let roll = rand() * total;
  for (const route of ROUTES) {
    roll -= route.weight;
    if (roll <= 0) return route;
  }
  return ROUTES[0]!;
}

function estimatedDays(distanceKm: number): number {
  if (distanceKm <= 300) return 2;
  if (distanceKm <= 1000) return 4;
  if (distanceKm <= 2500) return 7;
  return 12;
}

interface CarrierPricing {
  id: string;
  baseFee: number;
  pricePerKg: number;
  pricePerKm: number;
  riskPercent: number;
  cubingFactor: number;
}

function quoteTotal(
  carrier: CarrierPricing,
  input: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number; cargoValue: number; distanceKm: number },
): number {
  const volumetric = (input.lengthCm * input.widthCm * input.heightCm) / carrier.cubingFactor;
  const chargeable = Math.max(input.weightKg, volumetric);
  return round2(
    carrier.baseFee +
      chargeable * carrier.pricePerKg +
      input.distanceKm * carrier.pricePerKm +
      input.cargoValue * carrier.riskPercent,
  );
}

async function seedTenant(input: {
  name: string;
  slug: string;
  users: { name: string; emailPrefix: string; role: 'ADMIN' | 'MANAGER' | 'OPERATOR' }[];
  customerNames: { name: string; city: string; state: string; cep?: string }[];
  carriers: { name: string; baseFee: number; pricePerKg: number; pricePerKm: number; riskPercent: number }[];
  simulationCount: number;
}) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: input.slug },
    update: { name: input.name },
    create: { name: input.name, slug: input.slug },
  });

  // Limpa dados demo anteriores do tenant (idempotência do seed).
  await prisma.simulationQuote.deleteMany({ where: { simulation: { tenantId: tenant.id } } });
  await prisma.freightSimulation.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.insight.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.import.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.carrier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.refreshToken.deleteMany({ where: { user: { tenantId: tenant.id } } });
  await prisma.oAuthAccount.deleteMany({ where: { user: { tenantId: tenant.id } } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });

  const users = [];
  for (const user of input.users) {
    users.push(
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: user.name,
          email: `${user.emailPrefix}@${input.slug}.logisense.local`,
          passwordHash: DEMO_PASSWORD_HASH,
          role: user.role,
        },
      }),
    );
  }

  const customers = [];
  for (const [index, customer] of input.customerNames.entries()) {
    customers.push(
      await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: customer.name,
          document: `00.000.000/000${String(index + 1).padStart(2, '0')}-00`,
          cep: customer.cep ?? null,
          email: `contato@${customer.name.toLowerCase().replace(/[^a-z]/g, '')}.com.br`,
          city: customer.city,
          state: customer.state,
        },
      }),
    );
  }

  const carriers = [];
  for (const carrier of input.carriers) {
    carriers.push(
      await prisma.carrier.create({
        data: {
          tenantId: tenant.id,
          name: carrier.name,
          baseFee: carrier.baseFee,
          pricePerKg: carrier.pricePerKg,
          pricePerKm: carrier.pricePerKm,
          riskPercent: carrier.riskPercent,
          cubingFactor: 6000,
        },
      }),
    );
  }

  const pricing: CarrierPricing[] = carriers.map((carrier, index) => ({
    id: carrier.id,
    baseFee: input.carriers[index]!.baseFee,
    pricePerKg: input.carriers[index]!.pricePerKg,
    pricePerKm: input.carriers[index]!.pricePerKm,
    riskPercent: input.carriers[index]!.riskPercent,
    cubingFactor: 6000,
  }));

  // Simulações distribuídas nos últimos 60 dias.
  for (let i = 0; i < input.simulationCount; i += 1) {
    const route = pickRoute();
    const weightKg = round2(5 + rand() * 1200);
    const lengthCm = round2(20 + rand() * 180);
    const widthCm = round2(20 + rand() * 120);
    const heightCm = round2(20 + rand() * 120);
    const cargoValue = round2(1000 + rand() * 90000);
    const volumetric = round2((lengthCm * widthCm * heightCm) / 6000);
    const chargeable = round2(Math.max(weightKg, volumetric));
    const createdAt = new Date(Date.now() - rand() * 60 * 24 * 60 * 60 * 1000);

    const quotedCarriers = [...pricing]
      .sort(() => rand() - 0.5)
      .slice(0, 2 + Math.floor(rand() * (pricing.length - 1)));

    const totals = quotedCarriers.map((carrier) => ({
      carrierId: carrier.id,
      total: quoteTotal(carrier, {
        weightKg,
        lengthCm,
        widthCm,
        heightCm,
        cargoValue,
        distanceKm: route.distanceKm,
      }),
      days: estimatedDays(route.distanceKm),
    }));
    const cheapest = totals.reduce((a, b) => (a.total <= b.total ? a : b));

    const simulation = await prisma.freightSimulation.create({
      data: {
        id: randomUUID(),
        tenantId: tenant.id,
        userId: pick(users).id,
        customerId: rand() < 0.7 ? pick(customers).id : null,
        selectedCarrierId: rand() < 0.8 ? cheapest.carrierId : null,
        origin: route.origin,
        destination: route.destination,
        weightKg,
        lengthCm,
        widthCm,
        heightCm,
        cargoValue,
        distanceKm: route.distanceKm,
        volumetricWeightKg: volumetric,
        chargeableWeightKg: chargeable,
        createdAt,
      },
    });

    await prisma.simulationQuote.createMany({
      data: totals.map((quote) => ({
        id: randomUUID(),
        simulationId: simulation.id,
        carrierId: quote.carrierId,
        freightCost: round2(quote.total * 0.9),
        additionalFees: round2(quote.total * 0.1),
        totalCost: quote.total,
        estimatedDays: quote.days,
        isCheapest: quote.carrierId === cheapest.carrierId,
      })),
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: users[0]!.id,
      action: 'SEED_COMPLETED',
      entity: 'Tenant',
      entityId: tenant.id,
      metadata: { simulationCount: input.simulationCount },
    },
  });

  return { tenant, userCount: users.length, simulationCount: input.simulationCount };
}

async function main() {
  const acme = await seedTenant({
    name: 'Acme Logística',
    slug: 'acme',
    users: [
      { name: 'Alice Admin', emailPrefix: 'admin', role: 'ADMIN' },
      { name: 'Marina Gestora', emailPrefix: 'manager1', role: 'MANAGER' },
      { name: 'Mario Gestor', emailPrefix: 'manager2', role: 'MANAGER' },
      { name: 'Otto Operador', emailPrefix: 'op1', role: 'OPERATOR' },
      { name: 'Olivia Operadora', emailPrefix: 'op2', role: 'OPERATOR' },
      { name: 'Oscar Operador', emailPrefix: 'op3', role: 'OPERATOR' },
      { name: 'Olga Operadora', emailPrefix: 'op4', role: 'OPERATOR' },
      { name: 'Omar Operador', emailPrefix: 'op5', role: 'OPERATOR' },
    ],
    customerNames: [
      { name: 'Mercado Central', city: 'São Paulo', state: 'SP', cep: '01000000' },
      { name: 'Varejo Nordeste', city: 'Fortaleza', state: 'CE', cep: '60000000' },
      { name: 'Atacado Sul', city: 'Porto Alegre', state: 'RS', cep: '90000000' },
      { name: 'Distribuidora Leste', city: 'Rio de Janeiro', state: 'RJ', cep: '20000000' },
      { name: 'Comercial Oeste', city: 'Brasília', state: 'DF', cep: '70000000' },
      { name: 'Supermercados Norte', city: 'Manaus', state: 'AM', cep: '69000000' },
      { name: 'Loja Mineira', city: 'Belo Horizonte', state: 'MG', cep: '30000000' },
      { name: 'Empório Baiano', city: 'Salvador', state: 'BA', cep: '40000000' },
      { name: 'Atacadão Paranaense', city: 'Curitiba', state: 'PR', cep: '80000000' },
      { name: 'Varejo Pernambucano', city: 'Recife', state: 'PE', cep: '50000000' },
      { name: 'Distribuidora Carioca', city: 'Rio de Janeiro', state: 'RJ', cep: '21000000' },
      { name: 'Central Paulista', city: 'São Paulo', state: 'SP', cep: '01310000' },
    ],
    carriers: [
      { name: 'TransVeloz', baseFee: 45, pricePerKg: 1.85, pricePerKm: 0.62, riskPercent: 0.004 },
      { name: 'Carga Certa', baseFee: 60, pricePerKg: 1.62, pricePerKm: 0.58, riskPercent: 0.005 },
      { name: 'Rota Livre', baseFee: 30, pricePerKg: 2.1, pricePerKm: 0.7, riskPercent: 0.003 },
      { name: 'Expresso Nacional', baseFee: 80, pricePerKg: 1.45, pricePerKm: 0.55, riskPercent: 0.006 },
      { name: 'Transportes Andina', baseFee: 50, pricePerKg: 1.75, pricePerKm: 0.6, riskPercent: 0.0045 },
    ],
    simulationCount: 120,
  });

  const beta = await seedTenant({
    name: 'Beta Transportes',
    slug: 'beta',
    users: [
      { name: 'Beto Admin', emailPrefix: 'admin', role: 'ADMIN' },
      { name: 'Bia Operadora', emailPrefix: 'op1', role: 'OPERATOR' },
    ],
    customerNames: [
      { name: 'Cliente Beta Um', city: 'São Paulo', state: 'SP', cep: '01001000' },
      { name: 'Cliente Beta Dois', city: 'Curitiba', state: 'PR', cep: '80010000' },
      { name: 'Cliente Beta Três', city: 'Salvador', state: 'BA', cep: '40010000' },
    ],
    carriers: [
      { name: 'Beta Cargas', baseFee: 40, pricePerKg: 1.9, pricePerKm: 0.65, riskPercent: 0.004 },
      { name: 'Beta Express', baseFee: 70, pricePerKg: 1.5, pricePerKm: 0.6, riskPercent: 0.005 },
    ],
    simulationCount: 10,
  });

  console.log(`Seed OK: ${acme.tenant.slug} (${acme.simulationCount} sims), ${beta.tenant.slug} (${beta.simulationCount} sims)`);
}

await main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
