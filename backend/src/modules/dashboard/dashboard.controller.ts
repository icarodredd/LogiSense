import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get('overview')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.overview(user);
  }

  @Get('carriers')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  carriers(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.carriers(user);
  }

  @Get('routes')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  routes(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.routes(user);
  }
}
