import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`WebSocket client connected: ${client.id}`, 'WebSocketGateway');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket client disconnected: ${client.id}`, 'WebSocketGateway');
  }

  @SubscribeMessage('join-import')
  handleJoinImport(@MessageBody() body: { importId: string }, @ConnectedSocket() client: Socket) {
    client.join(`import-${body.importId}`);
    this.logger.log(`Client ${client.id} joined room import-${body.importId}`, 'WebSocketGateway');
  }

  emitImportProgress(importId: string, data: {
    status: string;
    processed: number;
    total: number;
    percentage: number;
    errorMessage?: string;
  }) {
    this.server.to(`import-${importId}`).emit('import-progress', data);
  }
}
