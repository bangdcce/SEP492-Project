import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from 'src/database/entities';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  relatedType?: string | null;
  relatedId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(userId: string, options: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;

    const qb = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options.unreadOnly) {
      qb.andWhere('notification.isRead = false');
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return await this.notificationRepo.save(notification);
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async create(input: CreateNotificationInput) {
    const [notification] = await this.createMany([input]);
    return notification ?? null;
  }

  async createMany(inputs: CreateNotificationInput[]) {
    const normalized = inputs
      .filter((input) => input?.userId && input.title?.trim() && input.body?.trim())
      .map((input) =>
        this.notificationRepo.create({
          userId: input.userId,
          title: input.title.trim(),
          body: input.body.trim(),
          relatedType: input.relatedType ?? null,
          relatedId: input.relatedId ?? null,
        }),
      );

    if (normalized.length === 0) {
      return [];
    }

    const saved = await this.notificationRepo.save(normalized);
    saved.forEach((notification) => {
      this.eventEmitter.emit('notification.created', { notification });
    });

    return saved;
  }
}
