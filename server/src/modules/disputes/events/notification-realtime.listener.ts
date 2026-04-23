import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeGateway } from '../gateways/dispute.gateway';
import { NotificationEntity } from 'src/database/entities';

const SafeOnEvent = (event: string) => OnEvent(event, { suppressErrors: true });

@Injectable()
export class NotificationRealtimeListener {
  constructor(private readonly disputeGateway: DisputeGateway) {}

  @SafeOnEvent('notification.created')
  handleNotificationCreated(payload: { notification?: NotificationEntity }) {
    if (!payload?.notification?.userId) {
      return;
    }

    this.disputeGateway.emitUserEvent(payload.notification.userId, 'NOTIFICATION_CREATED', {
      notification: payload.notification,
    });
  }
}
