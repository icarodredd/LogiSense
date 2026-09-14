import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Public()
  @Get()
  @HttpCode(200)
  async check() {
    return this.health.check();
  }
}
