import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeGateway } from '../gateways/dispute.gateway';

const SafeOnEvent = (event: string) => OnEvent(event, { suppressErrors: true });

@Injectable()
export class CalendarRealtimeListener {
  constructor(private readonly gateway: DisputeGateway) {}

  private toIsoString(value?: Date | string | null): string {
    if (!value) {
      return new Date().toISOString();
    }

    return new Date(value).toISOString();
  }

  private collectUserIds(payload: Record<string, any>): string[] {
    const recipientIds = new Set<string>();

    const directKeys = [
      'userId',
      'organizerId',
      'requesterId',
      'participantUserId',
      'processedById',
      'responderId',
    ];

    directKeys.forEach((key) => {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        recipientIds.add(value);
      }
    });

    const listKeys = ['userIds', 'participantUserIds'];
    listKeys.forEach((key) => {
      const values = payload[key];
      if (!Array.isArray(values)) {
        return;
      }

      values.forEach((value) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          recipientIds.add(value);
        }
      });
    });

    return Array.from(recipientIds);
  }

  private emitUserEvents(userIds: string[], eventName: string, payload: Record<string, any>): void {
    userIds.forEach((userId) => {
      this.gateway.emitUserEvent(userId, eventName, payload);
    });
  }

  @SafeOnEvent('calendar.eventCreated')
  handleCalendarEventCreated(payload: Record<string, any>): void {
    if (!payload?.eventId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.startTime || payload.createdAt),
    };

    this.emitUserEvents(this.collectUserIds(eventPayload), 'CALENDAR_EVENT_CREATED', eventPayload);
    this.gateway.emitStaffDashboardEvent('CALENDAR_EVENT_CREATED', eventPayload);
  }

  @SafeOnEvent('calendar.eventUpdated')
  handleCalendarEventUpdated(payload: Record<string, any>): void {
    if (!payload?.eventId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.updatedAt || payload.startTime),
    };

    this.emitUserEvents(this.collectUserIds(eventPayload), 'CALENDAR_EVENT_UPDATED', eventPayload);
    this.gateway.emitStaffDashboardEvent('CALENDAR_EVENT_UPDATED', eventPayload);
  }

  @SafeOnEvent('calendar.rescheduleRequested')
  handleCalendarRescheduleRequested(payload: Record<string, any>): void {
    if (!payload?.requestId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.createdAt),
    };

    this.emitUserEvents(
      this.collectUserIds(eventPayload),
      'CALENDAR_RESCHEDULE_REQUESTED',
      eventPayload,
    );
    this.gateway.emitStaffDashboardEvent('CALENDAR_RESCHEDULE_REQUESTED', eventPayload);
  }

  @SafeOnEvent('calendar.rescheduleProcessed')
  handleCalendarRescheduleProcessed(payload: Record<string, any>): void {
    if (!payload?.requestId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.processedAt),
    };

    this.emitUserEvents(
      this.collectUserIds(eventPayload),
      'CALENDAR_RESCHEDULE_PROCESSED',
      eventPayload,
    );
    this.gateway.emitStaffDashboardEvent('CALENDAR_RESCHEDULE_PROCESSED', eventPayload);
  }

  @SafeOnEvent('calendar.inviteResponded')
  handleCalendarInviteResponded(payload: Record<string, any>): void {
    if (!payload?.eventId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.respondedAt),
    };

    this.emitUserEvents(this.collectUserIds(eventPayload), 'CALENDAR_INVITE_RESPONDED', eventPayload);
    this.gateway.emitStaffDashboardEvent('CALENDAR_INVITE_RESPONDED', eventPayload);
  }

  @SafeOnEvent('calendar.availabilityUpdated')
  handleCalendarAvailabilityUpdated(payload: Record<string, any>): void {
    if (!payload?.userId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    this.emitUserEvents([payload.userId], 'CALENDAR_AVAILABILITY_UPDATED', eventPayload);
  }

  @SafeOnEvent('calendar.availabilityDeleted')
  handleCalendarAvailabilityDeleted(payload: Record<string, any>): void {
    if (!payload?.userId || !payload?.availabilityId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    this.emitUserEvents([payload.userId], 'CALENDAR_AVAILABILITY_DELETED', eventPayload);
  }
}
