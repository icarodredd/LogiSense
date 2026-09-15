import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketGateway as WsGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service.js';
import { WsAuthService } from './ws-auth.service.js';
import { ImportRoomService } from './import-room.service.js';

@WsGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(AppLogger) private readonly logger: AppLogger,
    @Inject(WsAuthService) private readonly wsAuth: WsAuthService,
    @Inject(ImportRoomService) private readonly importRooms: ImportRoomService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      this.logger.log(
        `WebSocket client connected: ${client.id} (user ${user.id})`,
        'WebSocketGateway',
      );
    } catch {
      this.logger.warn(
        `WebSocket connection rejected: ${client.id}`,
        'WebSocketGateway',
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket client disconnected: ${client.id}`, 'WebSocketGateway');
  }

  @SubscribeMessage('join-import')
  async handleJoinImport(
    @MessageBody() body: { importId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.wsAuth.extractSocketUser(client);
    if (!user || !body?.importId) {
      this.logger.warn(
        `join-import rejected (no user or importId): ${client.id}`,
        'WebSocketGateway',
      );
      return { ok: false, error: 'UNAUTHORIZED' };
    }
    const allowed = await this.importRooms.canJoin(user, body.importId);
    if (!allowed) {
      this.logger.warn(
        `join-import rejected (tenant mismatch): ${client.id} import ${body.importId}`,
        'WebSocketGateway',
      );
      return { ok: false, error: 'FORBIDDEN' };
    }
    client.join(`import-${body.importId}`);
    this.logger.log(
      `Client ${client.id} joined room import-${body.importId}`,
      'WebSocketGateway',
    );
    return { ok: true };
  }

  emitImportProgress(
    importId: string,
    data: {
      status: string;
      processed: number;
      total: number;
      percentage: number;
      errorMessage?: string;
    },
  ) {
    this.server.to(`import-${importId}`).emit('import-progress', data);
  }
}
