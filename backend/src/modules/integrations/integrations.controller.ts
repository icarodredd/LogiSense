import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { IsNumber } from 'class-validator';
import { Type as TypeTransform } from 'class-transformer';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { IntegrationsService } from './integrations.service.js';

class WeatherQueryDto {
  @TypeTransform(() => Number)
  @IsNumber()
  lat!: number;

  @TypeTransform(() => Number)
  @IsNumber()
  lon!: number;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Get('cep/:cep')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  lookupCep(@CurrentUser() _user: AuthenticatedUser, @Param('cep') cep: string) {
    return this.integrations.lookupCep(cep);
  }

  @Get('weather')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  getWeather(
    @CurrentUser() _user: AuthenticatedUser,
    @Query() query: WeatherQueryDto,
  ) {
    return this.integrations.getWeather(query.lat, query.lon);
  }
}
