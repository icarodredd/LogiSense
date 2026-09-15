import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
import { ImportWorker } from './import.worker.js';
import { WebSocketGateway } from '../../websocket/websocket.gateway.js';

@Module({
  imports: [AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportWorker, WebSocketGateway],
  exports: [ImportsService],
})
export class ImportsModule {}
