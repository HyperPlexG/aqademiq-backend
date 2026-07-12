import { OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { RedisService } from '../../infra/redis.service';
import { TokenService } from '../../infra/token.service';

/**
 * §4.6 realtime invalidation: per-user WS revision stream replacing the app's
 * in-process `revisions` broadcast. Clients authenticate with their access
 * token on the handshake and join room `user:{id}`. A dedicated Redis
 * subscriber relays `revisions:*` pub/sub messages (published by
 * RevisionService.bump) to the matching room — works across Cloud Run instances.
 */
@WebSocketGateway({ namespace: '/me/revisions', cors: { origin: true } })
export class RevisionsGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer() server!: Server;
  private sub!: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  onModuleInit() {
    // Dedicated connection: a subscriber cannot run normal commands.
    this.sub = this.redis.client.duplicate();
    this.sub.psubscribe('revisions:*');
    this.sub.on('pmessage', (_pattern, channel, message) => {
      const userId = channel.slice('revisions:'.length);
      this.server.to(`user:${userId}`).emit('revision', JSON.parse(message));
    });
  }

  async handleConnection(socket: Socket) {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined) ??
      socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return socket.disconnect(true);
    try {
      const claims = await this.tokens.verifyAccess(token);
      socket.join(`user:${claims.sub}`);
      socket.emit('connected', { user_id: claims.sub });
    } catch {
      socket.disconnect(true);
    }
  }
}
