import type { Server } from 'socket.io';
import type { RequestChatMessage } from './request-chat.service';

export class RequestChatRealtimeBridge {
  private static server: Server | null = null;

  static bindServer(server: Server): void {
    this.server = server;
  }

  static emitMessage(message: RequestChatMessage): void {
    this.server?.to(this.requestRoom(message.requestId)).emit('newRequestMessage', message);
  }

  private static requestRoom(requestId: string): string {
    return `request_${requestId}`;
  }
}
