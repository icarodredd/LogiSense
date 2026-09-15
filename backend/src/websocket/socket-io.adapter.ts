import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';

type CreateIOServerOptions = Parameters<IoAdapter['createIOServer']>[1];

export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: CreateIOServerOptions) {
    const origins = this.config.get<string[]>('corsOrigins', { infer: true }) ?? [];
    // ServerOptions de socket.io tipa props com default (path, serveClient,
    // adapter...) como obrigatórias, embora sejam opcionais em runtime —
    // o socket.io aplica os defaults quando ausentes.
    const merged = {
      ...options,
      cors: {
        origin: origins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    } as CreateIOServerOptions;
    return super.createIOServer(port, merged);
  }
}
