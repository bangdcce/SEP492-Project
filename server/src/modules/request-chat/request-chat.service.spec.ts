import { ForbiddenException } from '@nestjs/common';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { StaffApplicationStatus } from '../../database/entities/staff-application.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RequestChatService } from './request-chat.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

describe('RequestChatService', () => {
  let service: RequestChatService;
  let requestMessageRepo: ReturnType<typeof createRepositoryMock>;
  let requestRepo: ReturnType<typeof createRepositoryMock>;
  let notificationsService: { createMany: jest.Mock };

  beforeEach(() => {
    requestMessageRepo = createRepositoryMock();
    requestRepo = createRepositoryMock();
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };

    service = new RequestChatService(
      requestMessageRepo as any,
      requestRepo as any,
      notificationsService as any,
    );
  });

  const request = {
    id: 'request-1',
    clientId: 'client-1',
    brokerId: 'broker-1',
    proposals: [],
  } as ProjectRequestEntity;

  it('blocks pending staff from reading request chat', async () => {
    requestRepo.findOne.mockResolvedValue(request);

    await expect(
      service.assertRequestReadAccess('request-1', {
        id: 'staff-1',
        role: UserRole.STAFF,
        isVerified: false,
        staffApplication: {
          status: StaffApplicationStatus.PENDING,
        },
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows approved staff to read request chat', async () => {
    requestRepo.findOne.mockResolvedValue(request);

    await expect(
      service.assertRequestReadAccess('request-1', {
        id: 'staff-1',
        role: UserRole.STAFF,
        isVerified: true,
        staffApplication: {
          status: StaffApplicationStatus.APPROVED,
        },
      } as any),
    ).resolves.toBeUndefined();
  });

  it('keeps admin request chat access unchanged', async () => {
    requestRepo.findOne.mockResolvedValue(request);

    await expect(
      service.assertRequestReadAccess('request-1', {
        id: 'admin-1',
        role: UserRole.ADMIN,
        isVerified: true,
        staffApplication: null,
      } as any),
    ).resolves.toBeUndefined();
  });
});
