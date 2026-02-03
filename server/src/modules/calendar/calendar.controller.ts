import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, MoreThan, Repository } from 'typeorm';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  CalendarEventEntity,
  EventStatus,
  RescheduleRequestStatus,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import {
  EventParticipantEntity,
  ParticipantRole,
  ParticipantStatus,
} from 'src/database/entities/event-participant.entity';
import { EventRescheduleRequestEntity } from 'src/database/entities/event-reschedule-request.entity';
import { UserAvailabilityEntity } from 'src/database/entities/user-availability.entity';
import { AutoScheduleService } from './auto-schedule.service';
import { AvailabilityService } from './availability.service';
import { CalendarService } from './calendar.service';
import {
  CalendarEventFilterDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CreateRescheduleRequestDto,
  ProcessRescheduleRequestDto,
  RespondEventInviteDto,
  SetAvailabilityDto,
} from './dto';

const DEFAULT_RESPONSE_DEADLINE_HOURS = 24;

@ApiTags('Calendar')
@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(EventParticipantEntity)
    private readonly participantRepository: Repository<EventParticipantEntity>,
    @InjectRepository(EventRescheduleRequestEntity)
    private readonly rescheduleRepository: Repository<EventRescheduleRequestEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly calendarService: CalendarService,
    private readonly autoScheduleService: AutoScheduleService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  @Post('events')
  @ApiOperation({ summary: 'Create calendar event' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Event created' })
  async createEvent(@Body() dto: CreateCalendarEventDto, @GetUser() user: UserEntity) {
    if (dto.useAutoSchedule) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException('startTime/endTime are required for auto-schedule range');
      }
      const rangeStart = this.parseDate(dto.startTime, 'startTime');
      const rangeEnd = this.parseDate(dto.endTime, 'endTime');
      if (rangeStart >= rangeEnd) {
        throw new BadRequestException('startTime must be before endTime');
      }

      const participantIds = dto.participantUserIds || [];
      const result = await this.autoScheduleService.autoScheduleEvent({
        eventType: dto.type,
        title: dto.title,
        organizerId: user.id,
        participantIds,
        requiredParticipantIds: participantIds,
        dateRange: { start: rangeStart, end: rangeEnd },
        description: dto.description,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
      });

      return {
        success: true,
        message: result.manualRequired ? 'Manual scheduling required' : 'Event auto-scheduled',
        data: result,
      };
    }

    const startTime = this.parseDate(dto.startTime, 'startTime');
    const endTime = this.parseDate(dto.endTime, 'endTime');
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const durationMinutes = this.calculateDurationMinutes(startTime, endTime);
    const participantIds = Array.from(
      new Set((dto.participantUserIds || []).filter((id) => id !== user.id)),
    );
    const allParticipantIds = Array.from(new Set([user.id, ...participantIds]));

    if (allParticipantIds.length > 1) {
      const availability = await this.calendarService.findAvailableSlots({
        userIds: allParticipantIds,
        durationMinutes,
        dateRange: { start: startTime, end: endTime },
        stepMinutes: durationMinutes,
        maxSlots: 1,
      });
      if (
        availability.slots.length === 0 ||
        availability.slots[0].start.getTime() !== startTime.getTime()
      ) {
        throw new BadRequestException('Selected time conflicts with availability');
      }
    }

    const event = this.calendarRepository.create({
      type: dto.type,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      startTime,
      endTime,
      durationMinutes,
      organizerId: user.id,
      status: participantIds.length > 0 ? EventStatus.PENDING_CONFIRMATION : EventStatus.SCHEDULED,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      location: dto.location,
      externalMeetingLink: dto.externalMeetingLink,
      reminderMinutes: dto.reminderMinutes,
      notes: dto.notes,
      metadata: dto.metadata,
      isAutoScheduled: false,
    });

    const savedEvent = await this.calendarRepository.save(event);
    const responseDeadline = this.calculateResponseDeadline(startTime);

    const participantEntities: EventParticipantEntity[] = [];
    participantEntities.push(
      this.participantRepository.create({
        eventId: savedEvent.id,
        userId: user.id,
        role: ParticipantRole.ORGANIZER,
        status: ParticipantStatus.ACCEPTED,
        respondedAt: new Date(),
        responseDeadline,
      }),
    );

    for (const participantId of participantIds) {
      participantEntities.push(
        this.participantRepository.create({
          eventId: savedEvent.id,
          userId: participantId,
          role: ParticipantRole.REQUIRED,
          status: ParticipantStatus.PENDING,
          responseDeadline,
        }),
      );
    }

    if (participantEntities.length > 0) {
      await this.participantRepository.save(participantEntities);
    }

    await this.availabilityService.syncCalendarEvents({
      start: startTime,
      end: endTime,
    });

    return {
      success: true,
      message: 'Event created',
      data: {
        event: savedEvent,
        participants: participantEntities,
      },
    };
  }

  @Get('events')
  @ApiOperation({ summary: 'List calendar events' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Events retrieved' })
  async listEvents(@Query() query: CalendarEventFilterDto, @GetUser() user: UserEntity) {
    const qb = this.calendarRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.participants', 'participant');

    if (query.type) {
      qb.andWhere('event.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('event.status = :status', { status: query.status });
    }

    const startDate = query.startDate ? this.parseDate(query.startDate, 'startDate') : null;
    const endDate = query.endDate ? this.parseDate(query.endDate, 'endDate') : null;

    if (startDate && endDate) {
      qb.andWhere('event.startTime < :endDate AND event.endTime > :startDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('event.endTime > :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('event.startTime < :endDate', { endDate });
    }

    if (query.organizerId) {
      qb.andWhere('event.organizerId = :organizerId', { organizerId: query.organizerId });
    } else if (query.participantId) {
      qb.andWhere('participant.userId = :participantId', { participantId: query.participantId });
    } else {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('event.organizerId = :userId', { userId: user.id })
            .orWhere('participant.userId = :userId', { userId: user.id });
        }),
      );
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    qb.orderBy('event.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      success: true,
      data: {
        items,
        total,
        page,
        limit,
      },
    };
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update calendar event' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
    @GetUser() user: UserEntity,
  ) {
    const event = await this.calendarRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.STAFF &&
      event.organizerId !== user.id
    ) {
      throw new ForbiddenException('You are not allowed to update this event');
    }

    if ([EventStatus.CANCELLED, EventStatus.COMPLETED].includes(event.status)) {
      throw new BadRequestException(`Event is ${event.status}, cannot update`);
    }

    const previousStart = event.startTime;
    const previousEnd = event.endTime;

    const startTime = dto.startTime ? this.parseDate(dto.startTime, 'startTime') : event.startTime;
    const endTime = dto.endTime ? this.parseDate(dto.endTime, 'endTime') : event.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const durationMinutes = this.calculateDurationMinutes(startTime, endTime);

    await this.calendarRepository.update(event.id, {
      title: dto.title ?? event.title,
      description: dto.description ?? event.description,
      priority: dto.priority ?? event.priority,
      startTime,
      endTime,
      durationMinutes,
      location: dto.location ?? event.location,
      externalMeetingLink: dto.externalMeetingLink ?? event.externalMeetingLink,
      reminderMinutes: dto.reminderMinutes ?? event.reminderMinutes,
      notes: dto.notes ?? event.notes,
    });

    const updated = await this.calendarRepository.findOne({ where: { id: event.id } });

    const rangeStart = previousStart < startTime ? previousStart : startTime;
    const rangeEnd = previousEnd > endTime ? previousEnd : endTime;
    await this.availabilityService.syncCalendarEvents({
      start: rangeStart,
      end: rangeEnd,
    });

    return {
      success: true,
      message: 'Event updated',
      data: updated,
    };
  }

  @Post('events/:id/reschedule')
  @ApiOperation({ summary: 'Request event reschedule' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async requestReschedule(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateRescheduleRequestDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.eventId && dto.eventId !== eventId) {
      throw new BadRequestException('eventId in body does not match URL');
    }

    const event = await this.calendarRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const participants = await this.participantRepository.find({
      where: { eventId },
    });
    const participantIds = participants.map((p) => p.userId);
    const isParticipant = participantIds.includes(user.id) || event.organizerId === user.id;
    if (!isParticipant && user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF) {
      throw new ForbiddenException('You are not allowed to reschedule this event');
    }

    if (dto.proposedTimeSlots && dto.proposedTimeSlots.length > 3) {
      throw new BadRequestException('Maximum 3 proposed time slots allowed');
    }

    if (!dto.useAutoSchedule && (!dto.proposedTimeSlots || dto.proposedTimeSlots.length === 0)) {
      throw new BadRequestException('Provide proposedTimeSlots or enable auto schedule');
    }

    const proposedSlots = dto.proposedTimeSlots?.map((slot) => ({
      start: this.parseDate(slot.start, 'proposedTimeSlots.start'),
      end: this.parseDate(slot.end, 'proposedTimeSlots.end'),
    }));

    const request = this.rescheduleRepository.create({
      eventId,
      requesterId: user.id,
      reason: dto.reason,
      proposedTimeSlots: proposedSlots,
      useAutoSchedule: dto.useAutoSchedule || false,
    });
    const saved = await this.rescheduleRepository.save(request);

    if (!dto.useAutoSchedule) {
      return {
        success: true,
        message: 'Reschedule request submitted',
        data: {
          request: saved,
        },
      };
    }

    const result = await this.autoScheduleService.handleRescheduleRequest(saved.id, user.id);

    return {
      success: true,
      message: result.manualRequired ? 'Manual reschedule required' : 'Reschedule processed',
      data: result,
    };
  }

  @Get('reschedule-requests')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'List reschedule requests' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reschedule requests retrieved' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'AUTO_RESOLVED', 'WITHDRAWN'],
  })
  async listRescheduleRequests(
    @Query('status') status?: string,
    @Query('eventId') eventId?: string,
    @Query('requesterId') requesterId?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (status && !Object.values(RescheduleRequestStatus).includes(status)) {
      throw new BadRequestException('Invalid reschedule request status');
    }

    const qb = this.rescheduleRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.event', 'event')
      .leftJoinAndSelect('request.requester', 'requester')
      .orderBy('request.createdAt', 'DESC');

    if (status) {
      qb.andWhere('request.status = :status', { status });
    }
    if (eventId) {
      qb.andWhere('request.eventId = :eventId', { eventId });
    }
    if (requesterId) {
      qb.andWhere('request.requesterId = :requesterId', { requesterId });
    }

    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 20;
    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = Number.isNaN(limit) || limit < 1 ? 20 : limit;

    qb.skip((safePage - 1) * safeLimit).take(safeLimit);

    const [items, total] = await qb.getManyAndCount();
    const safeItems = items.map((request) => ({
      id: request.id,
      eventId: request.eventId,
      requesterId: request.requesterId,
      reason: request.reason,
      proposedTimeSlots: request.proposedTimeSlots || [],
      useAutoSchedule: request.useAutoSchedule,
      status: request.status,
      processedById: request.processedById,
      processedAt: request.processedAt,
      processNote: request.processNote,
      newEventId: request.newEventId,
      selectedNewStartTime: request.selectedNewStartTime,
      createdAt: request.createdAt,
      event: request.event
        ? {
            id: request.event.id,
            title: request.event.title,
            startTime: request.event.startTime,
            endTime: request.event.endTime,
            status: request.event.status,
            type: request.event.type,
            organizerId: request.event.organizerId,
            referenceType: request.event.referenceType,
            referenceId: request.event.referenceId,
          }
        : null,
      requester: request.requester
        ? {
            id: request.requester.id,
            fullName: request.requester.fullName,
            email: request.requester.email,
            role: request.requester.role,
          }
        : null,
    }));

    return {
      success: true,
      data: {
        items: safeItems,
        total,
        page: safePage,
        limit: safeLimit,
      },
    };
  }

  @Post('reschedule-requests/process')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Process reschedule request' })
  @HttpCode(HttpStatus.OK)
  async processRescheduleRequest(
    @Body() dto: ProcessRescheduleRequestDto,
    @GetUser() user: UserEntity,
  ) {
    const request = await this.rescheduleRepository.findOne({
      where: { id: dto.requestId },
    });
    if (!request) {
      throw new NotFoundException('Reschedule request not found');
    }

    if (request.status !== RescheduleRequestStatus.PENDING) {
      throw new BadRequestException('Reschedule request already processed');
    }

    if (!['approve', 'reject'].includes(dto.action)) {
      throw new BadRequestException('Invalid reschedule action');
    }

    if (dto.action === 'reject') {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: user.id,
        processedAt: new Date(),
        processNote: dto.processNote,
      });

      return {
        success: true,
        message: 'Reschedule request rejected',
        data: { id: request.id, status: RescheduleRequestStatus.REJECTED },
      };
    }

    if (dto.selectedNewStartTime) {
      const result = await this.autoScheduleService.processManualRescheduleRequest(
        request.id,
        new Date(dto.selectedNewStartTime),
        user.id,
        dto.processNote,
      );

      return {
        success: true,
        message: result.manualRequired ? 'Manual reschedule required' : 'Reschedule approved',
        data: result,
      };
    }

    const result = await this.autoScheduleService.handleRescheduleRequest(request.id, user.id);

    return {
      success: true,
      message: result.manualRequired ? 'Manual reschedule required' : 'Reschedule approved',
      data: result,
    };
  }

  @Post('events/:id/respond')
  @ApiOperation({ summary: 'Respond to event invitation' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async respondInvite(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: RespondEventInviteDto,
    @GetUser() user: UserEntity,
  ) {
    const participant = await this.participantRepository.findOne({
      where: { id: dto.participantId },
    });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    if (participant.eventId !== eventId) {
      throw new BadRequestException('participantId does not belong to this event');
    }
    if (
      participant.userId !== user.id &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.STAFF
    ) {
      throw new ForbiddenException('You are not allowed to respond for this invitation');
    }

    const result = await this.autoScheduleService.processEventInvitations(
      dto.participantId,
      dto.response,
      dto.responseNote,
    );

    return {
      success: true,
      message: 'Response recorded',
      data: result,
    };
  }

  // ===========================================================================
  // AVAILABILITY
  // ===========================================================================

  @Post('availability')
  @ApiOperation({ summary: 'Set user availability' })
  @HttpCode(HttpStatus.OK)
  async setAvailability(
    @Body() dto: SetAvailabilityDto,
    @GetUser() user: UserEntity,
    @Headers('x-timezone') headerTimeZone?: string,
  ) {
    const result = await this.availabilityService.setUserAvailability({
      userId: user.id,
      slots: dto.slots,
      recurring: dto.recurring,
      allowConflicts: dto.allowConflicts,
      timeZone: dto.timeZone || headerTimeZone,
    });

    return {
      success: true,
      message: 'Availability updated',
      data: result,
    };
  }

  @Delete('availability/:id')
  @ApiOperation({ summary: 'Delete availability slot' })
  @HttpCode(HttpStatus.OK)
  async deleteAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.availabilityService.deleteUserAvailability({
      userId: user.id,
      availabilityId: id,
    });

    return {
      success: true,
      message: 'Availability removed',
      data: result,
    };
  }

  @Get('availability/common')
  @ApiOperation({ summary: 'Find common availability slots for users' })
  @ApiQuery({ name: 'userIds', required: true, description: 'Comma-separated user IDs' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'durationMinutes', required: true })
  async findCommonAvailability(
    @Query('userIds') userIdsRaw: string,
    @Query('startDate') startDateRaw: string,
    @Query('endDate') endDateRaw: string,
    @Query('durationMinutes') durationRaw: string,
  ) {
    const userIds = (userIdsRaw || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (userIds.length === 0) {
      throw new BadRequestException('userIds is required');
    }

    const startDate = this.parseDate(startDateRaw, 'startDate');
    const endDate = this.parseDate(endDateRaw, 'endDate');
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const durationMinutes = Number(durationRaw);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new BadRequestException('durationMinutes must be greater than 0');
    }

    const result = await this.calendarService.findAvailableSlots({
      userIds,
      durationMinutes,
      dateRange: { start: startDate, end: endDate },
    });

    return {
      success: true,
      data: result,
    };
  }

  @Get('availability/staff')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get staff availability grid data' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'staffIds', required: false, description: 'Comma-separated staff IDs' })
  async getStaffAvailability(
    @Query('startDate') startDateRaw?: string,
    @Query('endDate') endDateRaw?: string,
    @Query('staffIds') staffIdsRaw?: string,
  ) {
    const rangeStart = startDateRaw
      ? this.parseDate(startDateRaw, 'startDate')
      : this.startOfDay(new Date());
    const rangeEnd = endDateRaw
      ? this.parseDate(endDateRaw, 'endDate')
      : this.addDays(rangeStart, 7);
    if (rangeStart >= rangeEnd) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const staffIds = staffIdsRaw
      ? staffIdsRaw
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];

    const staffQuery = this.userRepository.createQueryBuilder('user');
    if (staffIds.length > 0) {
      staffQuery.where('user.id IN (:...staffIds)', { staffIds });
    } else {
      staffQuery.where('user.role = :role', { role: UserRole.STAFF });
    }
    const staff = await staffQuery.getMany();
    const targetStaffIds = staff.map((item) => item.id);

    if (targetStaffIds.length === 0) {
      return { success: true, data: [] };
    }

    const availabilities = await this.availabilityRepository
      .createQueryBuilder('availability')
      .where('availability.userId IN (:...userIds)', { userIds: targetStaffIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('availability.isRecurring = true').orWhere(
            '(availability.startTime < :rangeEnd AND availability.endTime > :rangeStart)',
            { rangeStart, rangeEnd },
          );
        }),
      )
      .getMany();

    const organizerEvents = await this.calendarRepository.find({
      where: {
        organizerId: In(targetStaffIds),
        startTime: LessThan(rangeEnd),
        endTime: MoreThan(rangeStart),
        status: In([
          EventStatus.SCHEDULED,
          EventStatus.PENDING_CONFIRMATION,
          EventStatus.IN_PROGRESS,
          EventStatus.RESCHEDULING,
        ]),
      },
    });

    const participantEvents = await this.participantRepository
      .createQueryBuilder('participant')
      .innerJoinAndSelect('participant.event', 'event')
      .where('participant.userId IN (:...userIds)', { userIds: targetStaffIds })
      .andWhere('event.startTime < :rangeEnd AND event.endTime > :rangeStart', {
        rangeStart,
        rangeEnd,
      })
      .andWhere('event.status IN (:...statuses)', {
        statuses: [
          EventStatus.SCHEDULED,
          EventStatus.PENDING_CONFIRMATION,
          EventStatus.IN_PROGRESS,
          EventStatus.RESCHEDULING,
        ],
      })
      .getMany();

    const eventsByStaff = new Map<string, CalendarEventEntity[]>();
    for (const event of organizerEvents) {
      const list = eventsByStaff.get(event.organizerId) ?? [];
      list.push(event);
      eventsByStaff.set(event.organizerId, list);
    }
    for (const participant of participantEvents) {
      if (!participant.event) continue;
      const list = eventsByStaff.get(participant.userId) ?? [];
      if (!list.find((item) => item.id === participant.event.id)) {
        list.push(participant.event);
      }
      eventsByStaff.set(participant.userId, list);
    }

    const availabilityByStaff = new Map<string, UserAvailabilityEntity[]>();
    for (const entry of availabilities) {
      const list = availabilityByStaff.get(entry.userId) ?? [];
      list.push(entry);
      availabilityByStaff.set(entry.userId, list);
    }

    const data = staff.map((member) => ({
      staffId: member.id,
      name: member.fullName,
      availability: availabilityByStaff.get(member.id) ?? [],
      events: eventsByStaff.get(member.id) ?? [],
    }));

    return { success: true, data };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return date;
  }

  private calculateDurationMinutes(start: Date, end: Date): number {
    const minutes = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new BadRequestException('Invalid duration');
    }
    return minutes;
  }

  private calculateResponseDeadline(startTime: Date): Date {
    const deadline = new Date(
      startTime.getTime() - DEFAULT_RESPONSE_DEADLINE_HOURS * 60 * 60 * 1000,
    );
    return deadline > new Date() ? deadline : new Date();
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}
