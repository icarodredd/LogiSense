import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  imports: [AuditModule, DashboardModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
