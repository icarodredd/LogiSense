import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CepResponse } from './cep-response.dto.js';
import { WeatherResponse } from './weather-response.dto.js';

const VIACEP_BASE = 'https://viacep.com.br/ws';
const OPENMETEO_BASE = 'https://api.open-meteo.com/v1/forecast';

@Injectable()
export class IntegrationsService {
  async lookupCep(cep: string): Promise<CepResponse> {
    const normalized = cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_CEP',
        message: 'O CEP informado é inválido.',
      });
    }

    const res = await fetch(`${VIACEP_BASE}/${normalized}/json/`);
    if (!res.ok) {
      throw new BadRequestException({
        code: 'CEP_SERVICE_ERROR',
        message: 'Erro ao consultar o CEP.',
      });
    }

    const data = (await res.json()) as Record<string, unknown> & { erro?: boolean };
    if (data.erro) {
      throw new NotFoundException({
        code: 'CEP_NOT_FOUND',
        message: 'CEP não encontrado.',
      });
    }

    return {
      cep: (data.cep as string) ?? '',
      logradouro: (data.logradouro as string) ?? '',
      complemento: (data.complemento as string) ?? '',
      bairro: (data.bairro as string) ?? '',
      localidade: (data.localidade as string) ?? '',
      uf: (data.uf as string) ?? '',
      ibge: (data.ibge as string) ?? '',
      gia: (data.gia as string) ?? '',
      ddd: (data.ddd as string) ?? '',
    };
  }

  async getWeather(lat: number, lon: number): Promise<WeatherResponse> {
    if (lat < -90 || lat > 90) {
      throw new BadRequestException({
        code: 'INVALID_LATITUDE',
        message: 'Latitude deve estar entre -90 e 90.',
      });
    }
    if (lon < -180 || lon > 180) {
      throw new BadRequestException({
        code: 'INVALID_LONGITUDE',
        message: 'Longitude deve estar entre -180 e 180.',
      });
    }

    const url = new URL(OPENMETEO_BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current_weather', 'true');

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new BadRequestException({
        code: 'WEATHER_SERVICE_UNAVAILABLE',
        message: 'Serviço de clima indisponível.',
      });
    }

    const data = (await res.json()) as Record<string, unknown> & {
      current_weather?: {
        temperature: number;
        windspeed: number;
        weathercode: number;
        time: string;
      };
    };

    const current = data.current_weather;
    if (!current) {
      throw new BadRequestException({
        code: 'WEATHER_NO_DATA',
        message: 'Sem dados de clima para as coordenadas informadas.',
      });
    }

    return {
      temperature: current.temperature,
      windspeed: current.windspeed,
      weathercode: current.weathercode,
      time: current.time,
    };
  }
}
