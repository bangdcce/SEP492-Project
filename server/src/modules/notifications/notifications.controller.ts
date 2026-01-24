import { Controller, Get, Patch, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, GetUser } from '../auth';
import { UserEntity } from 'src/database/entities';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @GetUser() user: UserEntity,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('unreadOnly') unreadOnlyRaw?: string,
  ) {
    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 20;
    const unreadOnly = unreadOnlyRaw === 'true';

    const result = await this.notificationsService.list(user.id, {
      page,
      limit,
      unreadOnly,
    });

    return {
      success: true,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          isRead: item.isRead,
          readAt: item.readAt,
          relatedType: item.relatedType,
          relatedId: item.relatedId,
          createdAt: item.createdAt,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Patch(':id/read')
  async markRead(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    const updated = await this.notificationsService.markRead(user.id, id);

    return {
      success: true,
      data: {
        id: updated.id,
        isRead: updated.isRead,
        readAt: updated.readAt,
      },
    };
  }

  @Patch('read-all')
  async markAllRead(@GetUser() user: UserEntity) {
    await this.notificationsService.markAllRead(user.id);
    return { success: true };
  }
}
