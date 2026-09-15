// Distâncias rodoviárias aproximadas para rotas brasileiras (AGENTS.md §9).
// Usadas como referência determinística para cálculo de frete.
// A rota SP → Fortaleza representa ~21% das simulações (insight de concentração).

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

export function getRouteDistance(origin: string, destination: string): number | null {
  const key = `${origin.trim()}|${destination.trim()}`;
  return DISTANCES_KM[key] ?? null;
}

export { DISTANCES_KM };
