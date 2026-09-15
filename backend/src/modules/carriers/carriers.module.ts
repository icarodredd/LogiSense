import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CarriersController } from './carriers.controller.js';
import { CarriersService } from './carriers.service.js';

@Module({
  imports: [AuditModule],
  controllers: [CarriersController],
  providers: [CarriersService],
  exports: [CarriersService],
})
export class CarriersModule {}
