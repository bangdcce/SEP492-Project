import type { Server } from 'socket.io';
import type { WorkspaceChatMessage } from './workspace-chat.service';

export class WorkspaceChatRealtimeBridge {
  private static server: Server | null = null;

  static bindServer(server: Server): void {
    this.server = server;
  }

  static emitMessage(message: WorkspaceChatMessage): void {
    this.server?.to(this.projectRoom(message.projectId)).emit('newProjectMessage', message);
  }

  private static projectRoom(projectId: string): string {
    return `project_${projectId}`;
  }
}
