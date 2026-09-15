import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketGateway } from './websocket.gateway.js';
import { WsAuthService } from './ws-auth.service.js';
import { ImportRoomService } from './import-room.service.js';

@Module({
  imports: [JwtModule.register({})],
  providers: [WebSocketGateway, WsAuthService, ImportRoomService],
  exports: [WebSocketGateway, WsAuthService, ImportRoomService],
})
export class WebSocketModule {}
