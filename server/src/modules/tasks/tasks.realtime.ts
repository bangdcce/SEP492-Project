import type { Server } from 'socket.io';
import type { ProjectTaskRealtimeEvent } from './tasks.service';

export class TasksRealtimeBridge {
  private static server: Server | null = null;

  static bindServer(server: Server): void {
    this.server = server;
  }

  static emitProjectTaskChanged(event: ProjectTaskRealtimeEvent): void {
    this.server?.to(this.projectRoom(event.projectId)).emit('projectTaskChanged', event);
  }

  private static projectRoom(projectId: string): string {
    return `project_${projectId}`;
  }
}
