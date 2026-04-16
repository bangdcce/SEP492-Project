import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStaffInviteStatus } from 'src/database/entities/project.entity';
import { WorkspaceChatService } from './workspace-chat.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
});

describe('WorkspaceChatService.emailChatExport', () => {
  let service: WorkspaceChatService;
  let workspaceMessageRepo: ReturnType<typeof createRepositoryMock>;
  let projectRepo: ReturnType<typeof createRepositoryMock>;
  let taskRepo: ReturnType<typeof createRepositoryMock>;
  let auditLogsService: { logCustom: jest.Mock };
  let emailService: { sendWorkspaceChatExportEmail: jest.Mock };

  beforeEach(() => {
    workspaceMessageRepo = createRepositoryMock();
    projectRepo = createRepositoryMock();
    taskRepo = createRepositoryMock();
    auditLogsService = {
      logCustom: jest.fn().mockResolvedValue(undefined),
    };
    emailService = {
      sendWorkspaceChatExportEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new WorkspaceChatService(
      workspaceMessageRepo as any,
      projectRepo as any,
      taskRepo as any,
      auditLogsService as any,
      emailService as any,
    );
  });

  it('emails the generated export attachment to the authenticated requester', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      title: 'Alpha Workspace',
      clientId: 'user-1',
      brokerId: 'user-2',
      freelancerId: 'user-3',
      staffId: 'user-4',
      staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
    });

    const exportFile = {
      originalname: 'WorkspaceChat_alpha_20260413.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('xlsx-binary'),
    };

    const result = await service.emailChatExport(
      'project-1',
      {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner User',
      } as any,
      exportFile as any,
    );

    expect(emailService.sendWorkspaceChatExportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        recipientName: 'Owner User',
        projectTitle: 'Alpha Workspace',
        fileName: 'WorkspaceChat_alpha_20260413.xlsx',
        fileBuffer: exportFile.buffer,
        mimeType: exportFile.mimetype,
        exportedAt: expect.any(Date),
      }),
    );
    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'WORKSPACE_CHAT_EXPORT_EMAIL_SENT',
      'Project',
      'project-1',
      expect.objectContaining({
        userId: 'user-1',
        email: 'owner@example.com',
        fileName: 'WorkspaceChat_alpha_20260413.xlsx',
      }),
      undefined,
      'user-1',
    );
    expect(result).toEqual({
      message: 'Your chat log export has been emailed to you.',
      recipientEmail: 'owner@example.com',
      fileName: 'WorkspaceChat_alpha_20260413.xlsx',
    });
  });

  it('uses the current requester email as the only mail recipient', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      title: 'Alpha Workspace',
      clientId: 'user-9',
      brokerId: 'user-1',
      freelancerId: 'user-3',
      staffId: 'user-4',
      staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
    });

    await service.emailChatExport(
      'project-1',
      {
        id: 'user-1',
        email: 'broker@example.com',
        fullName: 'Broker User',
      } as any,
      {
        originalname: 'WorkspaceChat_alpha.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('xlsx-binary'),
      } as any,
    );

    expect(emailService.sendWorkspaceChatExportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'broker@example.com',
      }),
    );
    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user-9',
      }),
    );
  });

  it('throws a validation error and does not send email when the export file is missing', async () => {
    await expect(
      service.emailChatExport(
        'project-1',
        { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' } as any,
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalled();
    expect(projectRepo.findOne).not.toHaveBeenCalled();
  });

  it('rejects unsupported export file types before attempting email delivery', async () => {
    await expect(
      service.emailChatExport(
        'project-1',
        { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' } as any,
        {
          originalname: 'WorkspaceChat_alpha.csv',
          mimetype: 'text/csv',
          buffer: Buffer.from('csv'),
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalled();
    expect(projectRepo.findOne).not.toHaveBeenCalled();
  });

  it('throws a validation error when the requester does not have a valid email address', async () => {
    await expect(
      service.emailChatExport(
        'project-1',
        { id: 'user-1', email: 'invalid-email', fullName: 'Owner User' } as any,
        {
          originalname: 'WorkspaceChat_alpha.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('xlsx-binary'),
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalled();
  });

  it('propagates project authorization failures and does not send email', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      title: 'Alpha Workspace',
      clientId: 'user-9',
      brokerId: 'user-8',
      freelancerId: 'user-7',
      staffId: 'user-6',
      staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
    });

    await expect(
      service.emailChatExport(
        'project-1',
        { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' } as any,
        {
          originalname: 'WorkspaceChat_alpha.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('xlsx-binary'),
        } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalled();
  });

  it('propagates project not found failures and does not send email', async () => {
    projectRepo.findOne.mockResolvedValue(null);

    await expect(
      service.emailChatExport(
        'project-missing',
        { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' } as any,
        {
          originalname: 'WorkspaceChat_alpha.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('xlsx-binary'),
        } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(emailService.sendWorkspaceChatExportEmail).not.toHaveBeenCalled();
  });

  it('returns an internal error when email delivery fails', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      title: 'Alpha Workspace',
      clientId: 'user-1',
      brokerId: 'user-2',
      freelancerId: 'user-3',
      staffId: 'user-4',
      staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
    });
    emailService.sendWorkspaceChatExportEmail.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(
      service.emailChatExport(
        'project-1',
        { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' } as any,
        {
          originalname: 'WorkspaceChat_alpha.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('xlsx-binary'),
        } as any,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'WORKSPACE_CHAT_EXPORT_EMAIL_FAILED',
      'Project',
      'project-1',
      expect.objectContaining({
        userId: 'user-1',
        email: 'owner@example.com',
        fileName: 'WorkspaceChat_alpha.xlsx',
      }),
      undefined,
      'user-1',
    );
  });
});
