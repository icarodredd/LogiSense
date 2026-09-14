import { describe, expect, it } from 'vitest';
import { hashToken, parseDurationToMs } from './token.service.js';

describe('parseDurationToMs', () => {
  it('converte s/m/h/d', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('7d')).toBe(604_800_000);
  });

  it('rejeita formato inválido', () => {
    expect(() => parseDurationToMs('15')).toThrowError();
    expect(() => parseDurationToMs('abc')).toThrowError();
  });
});

describe('hashToken', () => {
  it('nunca expõe o token original e é determinístico', () => {
    const raw = 'segredo-opaco-123';
    const hashed = hashToken(raw);
    expect(hashed).not.toContain(raw);
    expect(hashed).toBe(hashToken(raw));
    expect(hashed).toHaveLength(64);
  });
});
