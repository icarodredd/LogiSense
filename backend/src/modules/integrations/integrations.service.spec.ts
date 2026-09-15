import { describe, expect, it, vi } from 'vitest';
import { IntegrationsService } from './integrations.service.js';
import { CepResponse } from './cep-response.dto.js';
import { WeatherResponse } from './weather-response.dto.js';

function buildService() {
  return new IntegrationsService();
}

describe('IntegrationsService — ViaCEP', () => {
  it('lookupCep retorna endereço para CEP válido', async () => {
    const service = buildService();
    const fakeCep = {
      cep: '01000000',
      logradouro: 'Praça da Sé',
      complemento: 'lado ímpar',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
      gia: '1004',
      ddd: '11',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeCep,
    } as never);

    const result = await service.lookupCep('01000000');
    expect(result).toEqual(fakeCep as CepResponse);
  });

  it('lookupCep normaliza CEP com hífen', async () => {
    const service = buildService();
    const fakeCep = {
      cep: '01000000',
      logradouro: 'Rua X',
      complemento: '',
      bairro: 'Y',
      localidade: 'Z',
      uf: 'SP',
      ibge: '',
      gia: '',
      ddd: '',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeCep,
    } as never);

    const result = await service.lookupCep('01000-000');
    expect(result.cep).toBe('01000000');
  });

  it('lookupCep rejeita CEP com caracteres inválidos', () => {
    const service = buildService();
    return expect(service.lookupCep('abc')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_CEP' }) }),
    );
  });

  it('lookupCep rejeita CEP vazio', () => {
    const service = buildService();
    return expect(service.lookupCep('')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_CEP' }) }),
    );
  });

  it('lookupCep rejeita CEP muito curto', () => {
    const service = buildService();
    return expect(service.lookupCep('1234567')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_CEP' }) }),
    );
  });

  it('lookupCep rejeita CEP muito longo', () => {
    const service = buildService();
    return expect(service.lookupCep('123456789')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_CEP' }) }),
    );
  });

  it('lookupCep retorna NOT_FOUND quando CEP não existe', async () => {
    const service = buildService();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    } as never);

    await expect(service.lookupCep('99999999')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'CEP_NOT_FOUND' }) }),
    );
  });

  it('lookupCep rejeita erro HTTP do serviço', async () => {
    const service = buildService();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as never);

    await expect(service.lookupCep('12345678')).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'CEP_SERVICE_ERROR' }) }),
    );
  });

  it('lookupCep nunca expõe dados sensíveis', async () => {
    const service = buildService();
    const sensitive = {
      cep: '01000000',
      logradouro: 'Rua secreta',
      complemento: '',
      bairro: '',
      localidade: '',
      uf: '',
      ibge: '',
      gia: '',
      ddd: '',
      passwordHash: 'nunca',
      token: 'nunca',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sensitive,
    } as never);

    const result = await service.lookupCep('01000000');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('token');
  });
});

describe('IntegrationsService — Open-Meteo', () => {
  it('getWeather retorna dados para coordenadas válidas', async () => {
    const service = buildService();
    const fakeWeather = {
      temperature: 22.5,
      windspeed: 15.3,
      weathercode: 1,
      time: '2026-09-14T12:00:00Z',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current_weather: fakeWeather }),
    } as never);

    const result = await service.getWeather(-23.5, -46.6);
    expect(result).toEqual(fakeWeather as WeatherResponse);
  });

  it('getWeather rejeita latitude > 90', () => {
    const service = buildService();
    return expect(service.getWeather(91, 0)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_LATITUDE' }) }),
    );
  });

  it('getWeather rejeita latitude < -90', () => {
    const service = buildService();
    return expect(service.getWeather(-91, 0)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_LATITUDE' }) }),
    );
  });

  it('getWeather rejeita longitude > 180', () => {
    const service = buildService();
    return expect(service.getWeather(0, 181)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_LONGITUDE' }) }),
    );
  });

  it('getWeather rejeita longitude < -180', () => {
    const service = buildService();
    return expect(service.getWeather(0, -181)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'INVALID_LONGITUDE' }) }),
    );
  });

  it('getWeather retorna erro quando serviço retorna erro', async () => {
    const service = buildService();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    } as never);

    await expect(service.getWeather(-23.5, -46.6)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'WEATHER_SERVICE_UNAVAILABLE' }) }),
    );
  });

  it('getWeather retorna erro quando sem dados de clima', async () => {
    const service = buildService();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as never);

    await expect(service.getWeather(-23.5, -46.6)).rejects.toThrowError(
      expect.objectContaining({ response: expect.objectContaining({ code: 'WEATHER_NO_DATA' }) }),
    );
  });

  it('getWeather URL contém lat e lon corretos', async () => {
    const service = buildService();
    const capturedUrl = { value: '' };
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl.value = url;
      return {
        ok: true,
        json: async () => ({
          current_weather: { temperature: 0, windspeed: 0, weathercode: 0, time: '' },
        }),
      } as never;
    });

    await service.getWeather(-23.55, -46.65);
    expect(capturedUrl.value).toContain('latitude=-23.55');
    expect(capturedUrl.value).toContain('longitude=-46.65');
    expect(capturedUrl.value).toContain('current_weather=true');
  });
});
