import { Controller, Get, Inject, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { InsightsService } from './insights.service.js';

@Controller('insights')
export class InsightsController {
  constructor(
    @Inject(InsightsService) private readonly insights: InsightsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.list(user);
  }

  @Post('regenerate')
  @Roles('ADMIN', 'MANAGER')
  regenerate(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.regenerate(user);
  }
}
