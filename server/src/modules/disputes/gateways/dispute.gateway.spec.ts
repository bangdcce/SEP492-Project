import { ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { DisputeGateway } from './dispute.gateway';
import { UserRole } from 'src/database/entities';

const repoMock = () => ({
  findOne: jest.fn(),
});

describe('DisputeGateway', () => {
  let gateway: DisputeGateway;
  let disputesService: { sendDisputeMessage: jest.Mock };

  beforeEach(() => {
    disputesService = {
      sendDisputeMessage: jest.fn(),
    };

    gateway = new DisputeGateway(
      { verify: jest.fn() } as any,
      {
        isHearingInviteDeclined: jest.fn(),
        markParticipantOnline: jest.fn(),
        markParticipantOffline: jest.fn(),
        getParticipantsPresence: jest.fn(),
      } as any,
      disputesService as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
    );
  });

  it('returns a structured non-retryable ack when the sender is muted', async () => {
    jest.spyOn(gateway as any, 'ensureDisputeAccess').mockResolvedValue(undefined);
    jest
      .spyOn(gateway as any, 'ensureHearingAccess')
      .mockResolvedValue({ trackPresence: true });
    disputesService.sendDisputeMessage.mockRejectedValue(
      new ForbiddenException('You are not allowed to speak at this time'),
    );

    const result = await gateway.sendDisputeMessage(
      {
        disputeId: 'd-1',
        hearingId: 'h-1',
        content: 'hello',
      } as any,
      {
        data: {
          user: {
            id: 'user-1',
            role: UserRole.CLIENT,
            email: 'user@example.com',
          },
        },
      } as any,
    );

    expect(result).toEqual({
      success: false,
      error: 'You are not allowed to speak at this time',
      errorCode: 'SPEAKER_BLOCKED',
      retryable: false,
    });
  });

  it('returns a structured non-retryable ack when the hearing invite was declined', async () => {
    jest.spyOn(gateway as any, 'ensureDisputeAccess').mockResolvedValue(undefined);
    jest
      .spyOn(gateway as any, 'ensureHearingAccess')
      .mockRejectedValue(new WsException('You declined this hearing invitation'));

    const result = await gateway.sendDisputeMessage(
      {
        disputeId: 'd-1',
        hearingId: 'h-1',
        content: 'hello',
      } as any,
      {
        data: {
          user: {
            id: 'user-1',
            role: UserRole.CLIENT,
            email: 'user@example.com',
          },
        },
      } as any,
    );

    expect(result).toEqual({
      success: false,
      error: 'You declined this hearing invitation',
      errorCode: 'HEARING_INVITE_DECLINED',
      retryable: false,
    });
  });
});
