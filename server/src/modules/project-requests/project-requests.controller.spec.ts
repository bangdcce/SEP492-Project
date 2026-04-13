import { BadRequestException } from '@nestjs/common';
jest.mock('./project-requests.service', () => ({
  ProjectRequestsService: class ProjectRequestsService {},
}));
import { UserRole } from '../../database/entities/user.entity';
import { ROLES_KEY } from '../auth/guards/roles.guard';
import { ProjectRequestsController } from './project-requests.controller';

describe('ProjectRequestsController', () => {
  let controller: ProjectRequestsController;
  let projectRequestsService: {
    create: jest.Mock;
    findDraftsByClient: jest.Mock;
    getInvitationsForUser: jest.Mock;
    getFreelancerRequestAccessList: jest.Mock;
    findMatches: jest.Mock;
    findOne: jest.Mock;
    assignBroker: jest.Mock;
    update: jest.Mock;
    publish: jest.Mock;
    deleteRequest: jest.Mock;
    inviteBroker: jest.Mock;
    inviteFreelancer: jest.Mock;
    approveFreelancerInvite: jest.Mock;
    rejectFreelancerInvite: jest.Mock;
    applyToRequest: jest.Mock;
    acceptBroker: jest.Mock;
    releaseBrokerSlot: jest.Mock;
    respondToInvitation: jest.Mock;
    approveSpecs: jest.Mock;
    convertToProject: jest.Mock;
  };

  beforeEach(() => {
    projectRequestsService = {
      create: jest.fn(),
      findDraftsByClient: jest.fn(),
      getInvitationsForUser: jest.fn(),
      getFreelancerRequestAccessList: jest.fn(),
      findMatches: jest.fn(),
      findOne: jest.fn(),
      assignBroker: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      deleteRequest: jest.fn(),
      inviteBroker: jest.fn(),
      inviteFreelancer: jest.fn(),
      approveFreelancerInvite: jest.fn(),
      rejectFreelancerInvite: jest.fn(),
      applyToRequest: jest.fn(),
      acceptBroker: jest.fn(),
      releaseBrokerSlot: jest.fn(),
      respondToInvitation: jest.fn(),
      approveSpecs: jest.fn(),
      convertToProject: jest.fn(),
    };

    controller = new ProjectRequestsController(
      projectRequestsService as any,
    );
  });

  it('UC14-CTRL-01 forwards POST /project-requests to ProjectRequestsService.create with the authenticated client id', async () => {
    const userId = 'client-1';
    const req = { requestId: 'req-context-1' } as any;
    const createDto = {
      title: 'Marketplace request',
      description: 'Build a platform for brokers and freelancers.',
      budgetRange: '$5,000 - $10,000',
      intendedTimeline: '8 weeks',
      techPreferences: 'NestJS, React',
      isDraft: false,
      answers: [
        { questionId: 'q-1', valueText: 'Marketplace' },
        { questionId: 'q-2', valueText: 'React' },
      ],
    };
    const createdRequest = {
      id: 'project-request-1',
      clientId: userId,
      title: createDto.title,
      status: 'PUBLIC_DRAFT',
      answers: createDto.answers,
    };

    projectRequestsService.create.mockResolvedValue(createdRequest);

    const result = await controller.create(userId, createDto as any, req);

    expect(projectRequestsService.create).toHaveBeenCalledWith(userId, createDto, req);
    expect(result).toEqual(createdRequest);
  });

  it('UC14-CTRL-02 propagates create-request failures from the service layer', async () => {
    const createDto = {
      title: 'Marketplace request',
      description: 'Build a platform for brokers and freelancers.',
      isDraft: false,
      answers: [],
    };

    projectRequestsService.create.mockRejectedValue(
      new BadRequestException('Request quota exceeded'),
    );

    await expect(
      controller.create('client-1', createDto as any, {} as any),
    ).rejects.toThrow(BadRequestException);
    expect(projectRequestsService.create).toHaveBeenCalledWith(
      'client-1',
      createDto,
      {},
    );
  });


  it('UC16-DRF-CTRL-01 forwards GET /project-requests/drafts/mine to ProjectRequestsService.findDraftsByClient with the authenticated client id', async () => {
    const clientId = 'client-1';
    const draftRequests = [
      {
        id: 'req-draft-2',
        clientId,
        title: 'Second draft request',
        status: 'DRAFT',
      },
      {
        id: 'req-draft-1',
        clientId,
        title: 'First draft request',
        status: 'DRAFT',
      },
    ];

    projectRequestsService.findDraftsByClient.mockResolvedValue(draftRequests);

    const result = await controller.findMyDrafts(clientId);

    expect(projectRequestsService.findDraftsByClient).toHaveBeenCalledWith(clientId);
    expect(result).toEqual(draftRequests);
  });

  it('UC54-INV-CTRL-01 forwards GET /project-requests/invitations/my to ProjectRequestsService.getInvitationsForUser with the authenticated user id and role', async () => {
    const user = {
      id: 'broker-1',
      role: 'BROKER',
    } as any;
    const invitations = [
      {
        id: 'proposal-1',
        brokerId: 'broker-1',
        status: 'INVITED',
      },
    ];

    projectRequestsService.getInvitationsForUser.mockResolvedValue(invitations);

    const result = await controller.getMyInvitations(user);

    expect(projectRequestsService.getInvitationsForUser).toHaveBeenCalledWith(
      'broker-1',
      'BROKER',
    );
    expect(result).toEqual(invitations);
  });

  it('UC57-ACC-CTRL-01 forwards GET /project-requests/freelancer/requests/my to ProjectRequestsService.getFreelancerRequestAccessList with the authenticated freelancer id', async () => {
    const user = {
      id: 'freelancer-1',
      role: 'FREELANCER',
    } as any;
    const requests = [
      {
        id: 'proposal-1',
        freelancerId: 'freelancer-1',
        status: 'ACCEPTED',
      },
    ];

    projectRequestsService.getFreelancerRequestAccessList.mockResolvedValue(requests);

    const result = await controller.getFreelancerRequestAccessList(user);

    expect(projectRequestsService.getFreelancerRequestAccessList).toHaveBeenCalledWith(
      'freelancer-1',
    );
    expect(result).toEqual(requests);
  });

  it('UC28-MAT-CTRL-01 forwards GET /project-requests/:id/matches to ProjectRequestsService.findMatches with the request id only', async () => {
    const matches = [
      {
        userId: 'broker-1',
        fullName: 'Broker One',
        matchScore: 91,
      },
    ];

    projectRequestsService.findMatches.mockResolvedValue(matches);

    const result = await controller.findMatches('req-match-1');

    expect(projectRequestsService.findMatches).toHaveBeenCalledWith('req-match-1');
    expect(result).toEqual(matches);
  });

  it('UC17-DET-CTRL-01 forwards GET /project-requests/:id to ProjectRequestsService.findOne with the request id and viewer', async () => {
    const user = {
      id: 'client-1',
      role: 'CLIENT',
    } as any;
    const detail = {
      id: 'req-1',
      clientId: 'client-1',
      title: 'Marketplace request',
      status: 'PUBLIC_DRAFT',
    };

    projectRequestsService.findOne.mockResolvedValue(detail);

    const result = await controller.getOne('req-1', user);

    expect(projectRequestsService.findOne).toHaveBeenCalledWith('req-1', user);
    expect(result).toEqual(detail);
  });

  it('applies explicit role metadata to the operational project-request endpoints that previously leaked pending staff', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.getProjectRequests)).toEqual([
      UserRole.CLIENT,
      UserRole.BROKER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.getOne)).toEqual([
      UserRole.CLIENT,
      UserRole.BROKER,
      UserRole.FREELANCER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.inviteBroker)).toEqual([
      UserRole.CLIENT,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.releaseBrokerSlot)).toEqual([
      UserRole.CLIENT,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
  });

  it('UC24-ASN-CTRL-01 forwards PATCH /project-requests/:id/assign to ProjectRequestsService.assignBroker with the request id, broker id, and request context', async () => {
    const req = { requestId: 'ctx-assign-1' } as any;
    const assigned = {
      id: 'req-assign-1',
      status: 'BROKER_ASSIGNED',
      brokerId: 'broker-1',
    };

    projectRequestsService.assignBroker.mockResolvedValue(assigned);

    const result = await controller.assignBroker('req-assign-1', 'broker-1', req);

    expect(projectRequestsService.assignBroker).toHaveBeenCalledWith(
      'req-assign-1',
      'broker-1',
      req,
    );
    expect(result).toEqual(assigned);
  });

  it('UC22-UPD-CTRL-01 forwards PATCH /project-requests/:id to ProjectRequestsService.update with the request id, dto, viewer, and request context', async () => {
    const req = { requestId: 'ctx-update-1' } as any;
    const user = { id: 'client-1', role: 'CLIENT' } as any;
    const dto = {
      title: 'Updated request title',
      description: 'Updated description',
      budgetRange: '$10,000 - $15,000',
    };
    const updated = {
      id: 'req-1',
      status: 'PUBLIC_DRAFT',
      title: dto.title,
    };

    projectRequestsService.update.mockResolvedValue(updated);

    const result = await controller.update('req-1', dto as any, user, req);

    expect(projectRequestsService.update).toHaveBeenCalledWith('req-1', dto, user, req);
    expect(result).toEqual(updated);
  });

  it('UC15-PUB-CTRL-01 forwards POST /project-requests/:id/publish to ProjectRequestsService.publish with the request id, client id, and request context', async () => {
    const req = { requestId: 'ctx-publish-1' } as any;
    const published = {
      id: 'req-publish-1',
      status: 'PUBLIC_DRAFT',
    };

    projectRequestsService.publish.mockResolvedValue(published);

    const result = await controller.publish('req-publish-1', 'client-1', req);

    expect(projectRequestsService.publish).toHaveBeenCalledWith(
      'req-publish-1',
      'client-1',
      req,
    );
    expect(result).toEqual(published);
  });

  it('UC19-DEL-CTRL-01 forwards DELETE /project-requests/:id to ProjectRequestsService.deleteRequest with the request id, client id, and request context', async () => {
    const req = { requestId: 'ctx-delete-1' } as any;
    const deleted = {
      success: true,
      message: 'Request deleted successfully',
    };

    projectRequestsService.deleteRequest.mockResolvedValue(deleted);

    const result = await controller.delete('req-delete-1', 'client-1', req);

    expect(projectRequestsService.deleteRequest).toHaveBeenCalledWith(
      'req-delete-1',
      'client-1',
      req,
    );
    expect(result).toEqual(deleted);
  });

  it('UC14-UPL-CTRL-01 uploads request files and returns requirement and attachment metadata', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const files = {
      requirements: [
        {
          originalname: 'requirements.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('req'),
        },
      ],
      attachments: [
        {
          originalname: 'brief.png',
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from('img'),
        },
      ],
    } as any;

    jest.spyOn(controller as any, 'assertFilesAllowed').mockImplementation(() => undefined);
    jest
      .spyOn(controller as any, 'persistRequestUpload')
      .mockImplementation(async (file: any, category: string) => ({
        filename: file.originalname,
        storagePath: `${category}/${file.originalname}`,
        url: `https://example.com/${category}/${file.originalname}`,
        mimetype: file.mimetype,
        size: file.size,
        category,
      }));

    const result = await controller.uploadFile(files, 'client-1');

    expect((controller as any).assertFilesAllowed).toHaveBeenCalledWith([
      ...files.requirements,
      ...files.attachments,
    ]);
    expect((controller as any).persistRequestUpload).toHaveBeenNthCalledWith(
      1,
      files.requirements[0],
      'requirements',
      'client-1',
    );
    expect((controller as any).persistRequestUpload).toHaveBeenNthCalledWith(
      2,
      files.attachments[0],
      'attachment',
      'client-1',
    );
    expect(result).toEqual({
      requirements: [
        expect.objectContaining({
          filename: 'requirements.pdf',
          category: 'requirements',
        }),
      ],
      attachments: [
        expect.objectContaining({
          filename: 'brief.png',
          category: 'attachment',
        }),
      ],
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Upload File Successful: requirements=1 attachments=1',
    );
  });

  it('UC14-UPL-CTRL-02 rejects unsupported upload types and logs the failure message', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const files = {
      requirements: [],
      attachments: [
        {
          originalname: 'payload.exe',
          mimetype: 'application/x-msdownload',
          size: 512,
          buffer: Buffer.from('bad'),
        },
      ],
    } as any;

    await expect(controller.uploadFile(files, 'client-1')).rejects.toThrow(BadRequestException);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Upload File Failed: Unsupported attachment type for "payload.exe". Allowed formats: PDF, Office, PNG, JPG, WEBP, TXT, CSV.',
    );
  });

  it('UC30-INV-CTRL-01 forwards POST /project-requests/:id/invite/broker to ProjectRequestsService.inviteBroker with request id, broker id, message, and inviter id', async () => {
    const invited = {
      id: 'proposal-broker-1',
      requestId: 'req-invite-1',
      brokerId: 'broker-1',
      status: 'INVITED',
    };

    projectRequestsService.inviteBroker.mockResolvedValue(invited);

    const result = await controller.inviteBroker(
      'req-invite-1',
      'client-1',
      'broker-1',
      'Please review this request.',
    );

    expect(projectRequestsService.inviteBroker).toHaveBeenCalledWith(
      'req-invite-1',
      'broker-1',
      'Please review this request.',
      'client-1',
    );
    expect(result).toEqual(invited);
  });

  it('UC30-INV-CTRL-02 forwards POST /project-requests/:id/invite/freelancer to ProjectRequestsService.inviteFreelancer with request id, freelancer id, message, and actor', async () => {
    const actor = { id: 'broker-1', role: 'BROKER' } as any;
    const invited = {
      id: 'proposal-freelancer-1',
      requestId: 'req-invite-1',
      freelancerId: 'freelancer-1',
      status: 'PENDING_CLIENT_APPROVAL',
    };

    projectRequestsService.inviteFreelancer.mockResolvedValue(invited);

    const result = await controller.inviteFreelancer(
      'req-invite-1',
      actor,
      'freelancer-1',
      'Strong frontend portfolio.',
    );

    expect(projectRequestsService.inviteFreelancer).toHaveBeenCalledWith(
      'req-invite-1',
      'freelancer-1',
      'Strong frontend portfolio.',
      actor,
    );
    expect(result).toEqual(invited);
  });

  it('EP-203-CTRL-01 forwards POST /project-requests/:id/approve-freelancer-invite to ProjectRequestsService.approveFreelancerInvite with request id, proposal id, and client id', async () => {
    const approved = {
      id: 'recommendation-approve-1',
      status: 'INVITED',
    };

    projectRequestsService.approveFreelancerInvite.mockResolvedValue(approved);

    const result = await controller.approveFreelancerInvite(
      'req-1',
      'client-1',
      'recommendation-approve-1',
    );

    expect(projectRequestsService.approveFreelancerInvite).toHaveBeenCalledWith(
      'req-1',
      'recommendation-approve-1',
      'client-1',
    );
    expect(result).toEqual(approved);
  });

  it('EP-204-CTRL-01 forwards POST /project-requests/:id/reject-freelancer-invite to ProjectRequestsService.rejectFreelancerInvite with request id, proposal id, and client id', async () => {
    const rejected = {
      id: 'recommendation-reject-1',
      status: 'REJECTED',
    };

    projectRequestsService.rejectFreelancerInvite.mockResolvedValue(rejected);

    const result = await controller.rejectFreelancerInvite(
      'req-1',
      'client-1',
      'recommendation-reject-1',
    );

    expect(projectRequestsService.rejectFreelancerInvite).toHaveBeenCalledWith(
      'req-1',
      'recommendation-reject-1',
      'client-1',
    );
    expect(result).toEqual(rejected);
  });

  it('UC62-APL-CTRL-01 forwards POST /project-requests/:id/apply to ProjectRequestsService.applyToRequest with request id, broker id, and cover letter', async () => {
    const proposal = {
      id: 'proposal-apply-1',
      requestId: 'req-1',
      brokerId: 'broker-1',
      status: 'PENDING',
    };

    projectRequestsService.applyToRequest.mockResolvedValue(proposal);

    const result = await controller.apply('req-1', 'broker-1', 'I can help with this request.');

    expect(projectRequestsService.applyToRequest).toHaveBeenCalledWith(
      'req-1',
      'broker-1',
      'I can help with this request.',
    );
    expect(result).toEqual(proposal);
  });

  it('EP-206-CTRL-01 forwards POST /project-requests/:id/accept-broker to ProjectRequestsService.acceptBroker with request id, broker id, and client id', async () => {
    const accepted = {
      id: 'req-1',
      status: 'BROKER_ASSIGNED',
      brokerId: 'broker-1',
    };

    projectRequestsService.acceptBroker.mockResolvedValue(accepted);

    const result = await controller.acceptBroker('req-1', 'client-1', 'broker-1');

    expect(projectRequestsService.acceptBroker).toHaveBeenCalledWith(
      'req-1',
      'broker-1',
      'client-1',
    );
    expect(result).toEqual(accepted);
  });

  it('EP-207-CTRL-01 forwards POST /project-requests/:id/release-broker-slot to ProjectRequestsService.releaseBrokerSlot with request id, broker application id, and actor', async () => {
    const actor = { id: 'client-1', role: 'CLIENT' } as any;
    const released = {
      id: 'req-1',
      status: 'PUBLIC_DRAFT',
    };

    projectRequestsService.releaseBrokerSlot.mockResolvedValue(released);

    const result = await controller.releaseBrokerSlot('req-1', 'application-1', actor);

    expect(projectRequestsService.releaseBrokerSlot).toHaveBeenCalledWith(
      'req-1',
      'application-1',
      actor,
    );
    expect(result).toEqual(released);
  });

  it('EP-210-CTRL-01 forwards PATCH /project-requests/invitations/:id/respond to ProjectRequestsService.respondToInvitation with invitation id, actor identity, role, and response status', async () => {
    const actor = { id: 'broker-1', role: 'BROKER' } as any;
    const invitation = {
      id: 'invite-1',
      requestId: 'req-1',
      status: 'ACCEPTED',
    };

    projectRequestsService.respondToInvitation.mockResolvedValue(invitation);

    const result = await controller.respondToInvitation(
      'invite-1',
      actor,
      'ACCEPTED',
    );

    expect(projectRequestsService.respondToInvitation).toHaveBeenCalledWith(
      'invite-1',
      'broker-1',
      'BROKER',
      'ACCEPTED',
    );
    expect(result).toEqual(invitation);
  });

  it('EP-210-CTRL-02 propagates invitation-response failures from the service layer', async () => {
    const actor = { id: 'freelancer-1', role: 'FREELANCER' } as any;

    projectRequestsService.respondToInvitation.mockRejectedValue(
      new BadRequestException('Invitation is no longer actionable'),
    );

    await expect(
      controller.respondToInvitation('invite-1', actor, 'REJECTED'),
    ).rejects.toThrow(BadRequestException);
    expect(projectRequestsService.respondToInvitation).toHaveBeenCalledWith(
      'invite-1',
      'freelancer-1',
      'FREELANCER',
      'REJECTED',
    );
  });
  it('approves finalized specs for a request', async () => {
    projectRequestsService.approveSpecs.mockResolvedValue({
      id: 'request-1',
      status: 'SPECS_APPROVED',
    });

    const result = await controller.approveSpecs('request-1');

    expect(projectRequestsService.approveSpecs).toHaveBeenCalledWith('request-1');
    expect(result).toEqual({
      id: 'request-1',
      status: 'SPECS_APPROVED',
    });
  });

  it('propagates approve-specs failures', async () => {
    projectRequestsService.approveSpecs.mockRejectedValue(new Error('approve failed'));

    await expect(controller.approveSpecs('request-1')).rejects.toThrow('approve failed');

    expect(projectRequestsService.approveSpecs).toHaveBeenCalledWith('request-1');
  });

  it('converts a finalized request to a project', async () => {
    projectRequestsService.convertToProject.mockResolvedValue({
      id: 'project-1',
      requestId: 'request-1',
    });

    const user = { id: 'broker-1' } as any;
    const result = await controller.convertToProject('request-1', user);

    expect(projectRequestsService.convertToProject).toHaveBeenCalledWith('request-1', user);
    expect(result).toEqual({
      id: 'project-1',
      requestId: 'request-1',
    });
  });

  it('propagates project-conversion failures', async () => {
    const user = { id: 'broker-1' } as any;
    projectRequestsService.convertToProject.mockRejectedValue(new Error('convert failed'));

    await expect(controller.convertToProject('request-1', user)).rejects.toThrow('convert failed');

    expect(projectRequestsService.convertToProject).toHaveBeenCalledWith('request-1', user);
  });
});
