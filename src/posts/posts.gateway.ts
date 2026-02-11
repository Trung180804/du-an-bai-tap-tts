import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
export class PostsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      const payload = await this.jwtService.verifyAsync(token);
      client.data.user = payload;
      console.log(`[Socket] User ${payload.email} connected`);
    } catch (e) {
      console.log('[Socket] Auth failed, disconnecting...');
      client.disconnect();
    }
  }

  notifyNewComment(postId: string, comment: any) {
    this.server.emit(`newComment:${postId}`, comment);
  }
}
