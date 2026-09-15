import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { FreightModule } from '../freight/freight.module.js';
import { SimulationsController } from './simulations.controller.js';
import { SimulationsService } from './simulations.service.js';

@Module({
  imports: [AuditModule, FreightModule],
  controllers: [SimulationsController],
  providers: [SimulationsService],
  exports: [SimulationsService],
})
export class SimulationsModule {}
