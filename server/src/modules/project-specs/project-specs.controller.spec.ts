import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSpecsController } from './project-specs.controller';
import { ProjectSpecsService } from './project-specs.service';
import { AuditAction } from './dto/audit-spec.dto';

describe('ProjectSpecsController', () => {
  let controller: ProjectSpecsController;

  const projectSpecsService = {
    findPendingSpecs: jest.fn(),
    findPendingClientReview: jest.fn(),
    findSpecsInFinalReview: jest.fn(),
    findSpecsByRequestIdForUser: jest.fn(),
    findClientSpecForUser: jest.fn(),
    findFullSpecForUser: jest.fn(),
    findOneForUser: jest.fn(),
    createClientSpec: jest.fn(),
    updateClientSpec: jest.fn(),
    submitForClientReview: jest.fn(),
    clientReviewSpec: jest.fn(),
    createFullSpec: jest.fn(),
    updateFullSpec: jest.fn(),
    submitForFinalReview: jest.fn(),
    signSpec: jest.fn(),
    requestFullSpecChanges: jest.fn(),
    createSpec: jest.fn(),
    approveSpec: jest.fn(),
    rejectSpec: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectSpecsController],
      providers: [
        {
          provide: ProjectSpecsService,
          useValue: projectSpecsService,
        },
      ],
    }).compile();

    controller = module.get(ProjectSpecsController);
  });

  it('returns pending specs for staff review', async () => {
    projectSpecsService.findPendingSpecs.mockResolvedValue([
      { id: 'spec-1', status: 'PENDING' },
    ]);

    const result = await controller.getPendingSpecs();

    expect(projectSpecsService.findPendingSpecs).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'spec-1', status: 'PENDING' }]);
  });

  it('propagates pending-spec lookup failures', async () => {
    projectSpecsService.findPendingSpecs.mockRejectedValue(new Error('pending lookup failed'));

    await expect(controller.getPendingSpecs()).rejects.toThrow('pending lookup failed');

    expect(projectSpecsService.findPendingSpecs).toHaveBeenCalled();
  });

  it('returns pending client-review specs for the authenticated client', async () => {
    projectSpecsService.findPendingClientReview.mockResolvedValue([
      { id: 'spec-2', status: 'CLIENT_REVIEW' },
    ]);

    const result = await controller.getPendingClientReview({
      id: 'client-1',
    } as never);

    expect(projectSpecsService.findPendingClientReview).toHaveBeenCalledWith('client-1');
    expect(result).toEqual([{ id: 'spec-2', status: 'CLIENT_REVIEW' }]);
  });

  it('propagates pending client-review lookup failures', async () => {
    projectSpecsService.findPendingClientReview.mockRejectedValue(
      new Error('client review lookup failed'),
    );

    await expect(
      controller.getPendingClientReview({
        id: 'client-1',
      } as never),
    ).rejects.toThrow('client review lookup failed');

    expect(projectSpecsService.findPendingClientReview).toHaveBeenCalledWith('client-1');
  });

  it('returns specs in final review for the authenticated party', async () => {
    projectSpecsService.findSpecsInFinalReview.mockResolvedValue([
      { id: 'spec-3', status: 'FINAL_REVIEW' },
    ]);

    const result = await controller.getSpecsInFinalReview({
      id: 'broker-1',
    } as never);

    expect(projectSpecsService.findSpecsInFinalReview).toHaveBeenCalledWith('broker-1');
    expect(result).toEqual([{ id: 'spec-3', status: 'FINAL_REVIEW' }]);
  });

  it('propagates final-review lookup failures', async () => {
    projectSpecsService.findSpecsInFinalReview.mockRejectedValue(
      new Error('final review lookup failed'),
    );

    await expect(
      controller.getSpecsInFinalReview({
        id: 'broker-1',
      } as never),
    ).rejects.toThrow('final review lookup failed');

    expect(projectSpecsService.findSpecsInFinalReview).toHaveBeenCalledWith('broker-1');
  });

  it('routes request-scoped spec lookup to findSpecsByRequestIdForUser', async () => {
    projectSpecsService.findSpecsByRequestIdForUser.mockResolvedValue([
      { id: 'spec-4', requestId: 'request-1' },
    ]);

    const user = { id: 'client-1' } as never;
    const result = await controller.getSpecsByRequest(user, 'request-1');

    expect(projectSpecsService.findSpecsByRequestIdForUser).toHaveBeenCalledWith(user, 'request-1');
    expect(result).toEqual([{ id: 'spec-4', requestId: 'request-1' }]);
  });

  it('propagates request-scoped spec lookup failures', async () => {
    const user = { id: 'client-1' } as never;
    projectSpecsService.findSpecsByRequestIdForUser.mockRejectedValue(
      new Error('request-scoped lookup failed'),
    );

    await expect(controller.getSpecsByRequest(user, 'request-1')).rejects.toThrow(
      'request-scoped lookup failed',
    );

    expect(projectSpecsService.findSpecsByRequestIdForUser).toHaveBeenCalledWith(user, 'request-1');
  });

  it('routes client-spec lookup to findClientSpecForUser', async () => {
    projectSpecsService.findClientSpecForUser.mockResolvedValue({
      id: 'spec-5',
      specPhase: 'CLIENT_SPEC',
    });

    const user = { id: 'broker-1' } as never;
    const result = await controller.getClientSpec(user, 'request-1');

    expect(projectSpecsService.findClientSpecForUser).toHaveBeenCalledWith(user, 'request-1');
    expect(result).toEqual({ id: 'spec-5', specPhase: 'CLIENT_SPEC' });
  });

  it('propagates client-spec lookup failures', async () => {
    const user = { id: 'broker-1' } as never;
    projectSpecsService.findClientSpecForUser.mockRejectedValue(
      new Error('client spec lookup failed'),
    );

    await expect(controller.getClientSpec(user, 'request-1')).rejects.toThrow(
      'client spec lookup failed',
    );

    expect(projectSpecsService.findClientSpecForUser).toHaveBeenCalledWith(user, 'request-1');
  });

  it('routes full-spec lookup to findFullSpecForUser', async () => {
    projectSpecsService.findFullSpecForUser.mockResolvedValue({
      id: 'spec-6',
      specPhase: 'FULL_SPEC',
    });

    const user = { id: 'freelancer-1' } as never;
    const result = await controller.getFullSpec(user, 'parent-spec-1');

    expect(projectSpecsService.findFullSpecForUser).toHaveBeenCalledWith(user, 'parent-spec-1');
    expect(result).toEqual({ id: 'spec-6', specPhase: 'FULL_SPEC' });
  });

  it('propagates full-spec lookup failures', async () => {
    const user = { id: 'freelancer-1' } as never;
    projectSpecsService.findFullSpecForUser.mockRejectedValue(
      new Error('full spec lookup failed'),
    );

    await expect(controller.getFullSpec(user, 'parent-spec-1')).rejects.toThrow(
      'full spec lookup failed',
    );

    expect(projectSpecsService.findFullSpecForUser).toHaveBeenCalledWith(user, 'parent-spec-1');
  });

  it('routes single-spec lookup to findOneForUser', async () => {
    projectSpecsService.findOneForUser.mockResolvedValue({
      id: 'spec-7',
      status: 'FINAL_REVIEW',
    });

    const user = { id: 'staff-1' } as never;
    const result = await controller.getSpec(user, 'spec-7');

    expect(projectSpecsService.findOneForUser).toHaveBeenCalledWith(user, 'spec-7');
    expect(result).toEqual({ id: 'spec-7', status: 'FINAL_REVIEW' });
  });

  it('propagates single-spec lookup failures', async () => {
    const user = { id: 'staff-1' } as never;
    projectSpecsService.findOneForUser.mockRejectedValue(new Error('spec lookup failed'));

    await expect(controller.getSpec(user, 'spec-7')).rejects.toThrow('spec lookup failed');

    expect(projectSpecsService.findOneForUser).toHaveBeenCalledWith(user, 'spec-7');
  });

  it('creates a client spec through the service', async () => {
    const dto = { requestId: 'request-1', title: 'Client spec' } as never;
    const req = { method: 'POST', path: '/project-specs/client-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createClientSpec.mockResolvedValue({ id: 'spec-8', specPhase: 'CLIENT_SPEC' });

    const result = await controller.createClientSpec(user, dto, req);

    expect(projectSpecsService.createClientSpec).toHaveBeenCalledWith(user, dto, req);
    expect(result).toEqual({ id: 'spec-8', specPhase: 'CLIENT_SPEC' });
  });

  it('propagates create-client-spec failures', async () => {
    const dto = { requestId: 'request-1', title: 'Client spec' } as never;
    const req = { method: 'POST', path: '/project-specs/client-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createClientSpec.mockRejectedValue(new Error('create client spec failed'));

    await expect(controller.createClientSpec(user, dto, req)).rejects.toThrow(
      'create client spec failed',
    );

    expect(projectSpecsService.createClientSpec).toHaveBeenCalledWith(user, dto, req);
  });

  it('updates a client spec through the service', async () => {
    const dto = { title: 'Updated client spec' } as never;
    const req = { method: 'PATCH', path: '/project-specs/spec-8/client-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.updateClientSpec.mockResolvedValue({ id: 'spec-8', title: 'Updated client spec' });

    const result = await controller.updateClientSpec(user, 'spec-8', dto, req);

    expect(projectSpecsService.updateClientSpec).toHaveBeenCalledWith(user, 'spec-8', dto, req);
    expect(result).toEqual({ id: 'spec-8', title: 'Updated client spec' });
  });

  it('propagates update-client-spec failures', async () => {
    const dto = { title: 'Updated client spec' } as never;
    const req = { method: 'PATCH', path: '/project-specs/spec-8/client-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.updateClientSpec.mockRejectedValue(new Error('update client spec failed'));

    await expect(controller.updateClientSpec(user, 'spec-8', dto, req)).rejects.toThrow(
      'update client spec failed',
    );

    expect(projectSpecsService.updateClientSpec).toHaveBeenCalledWith(user, 'spec-8', dto, req);
  });

  it('submits a client spec for client review through the service', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-8/submit-for-client-review' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.submitForClientReview.mockResolvedValue({
      id: 'spec-8',
      status: 'CLIENT_REVIEW',
    });

    const result = await controller.submitForClientReview(user, 'spec-8', req);

    expect(projectSpecsService.submitForClientReview).toHaveBeenCalledWith(user, 'spec-8', req);
    expect(result).toEqual({ id: 'spec-8', status: 'CLIENT_REVIEW' });
  });

  it('propagates submit-for-client-review failures', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-8/submit-for-client-review' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.submitForClientReview.mockRejectedValue(
      new Error('submit for client review failed'),
    );

    await expect(controller.submitForClientReview(user, 'spec-8', req)).rejects.toThrow(
      'submit for client review failed',
    );

    expect(projectSpecsService.submitForClientReview).toHaveBeenCalledWith(user, 'spec-8', req);
  });

  it('passes a null reason when the client approves without a reason', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-8/client-review' } as never;
    const user = { id: 'client-1' } as never;
    projectSpecsService.clientReviewSpec.mockResolvedValue({
      id: 'spec-8',
      status: 'APPROVED',
    });

    const result = await controller.clientReview(user, 'spec-8', { action: 'APPROVE' }, req);

    expect(projectSpecsService.clientReviewSpec).toHaveBeenCalledWith(
      user,
      'spec-8',
      'APPROVE',
      null,
      req,
    );
    expect(result).toEqual({ id: 'spec-8', status: 'APPROVED' });
  });

  it('forwards the reject reason when the client rejects a spec', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-8/client-review' } as never;
    const user = { id: 'client-1' } as never;
    projectSpecsService.clientReviewSpec.mockResolvedValue({
      id: 'spec-8',
      status: 'REJECTED',
      reason: 'Needs changes',
    });

    const result = await controller.clientReview(
      user,
      'spec-8',
      { action: 'REJECT', reason: 'Needs changes' },
      req,
    );

    expect(projectSpecsService.clientReviewSpec).toHaveBeenCalledWith(
      user,
      'spec-8',
      'REJECT',
      'Needs changes',
      req,
    );
    expect(result).toEqual({
      id: 'spec-8',
      status: 'REJECTED',
      reason: 'Needs changes',
    });
  });

  it('propagates client-review failures', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-8/client-review' } as never;
    const user = { id: 'client-1' } as never;
    projectSpecsService.clientReviewSpec.mockRejectedValue(new Error('client review failed'));

    await expect(
      controller.clientReview(user, 'spec-8', { action: 'APPROVE' }, req),
    ).rejects.toThrow('client review failed');

    expect(projectSpecsService.clientReviewSpec).toHaveBeenCalledWith(
      user,
      'spec-8',
      'APPROVE',
      null,
      req,
    );
  });

  it('creates a full spec through the service', async () => {
    const dto = { requestId: 'request-1', milestoneCount: 3 } as never;
    const req = { method: 'POST', path: '/project-specs/full-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createFullSpec.mockResolvedValue({ id: 'spec-9', specPhase: 'FULL_SPEC' });

    const result = await controller.createFullSpec(user, dto, req);

    expect(projectSpecsService.createFullSpec).toHaveBeenCalledWith(user, dto, req);
    expect(result).toEqual({ id: 'spec-9', specPhase: 'FULL_SPEC' });
  });

  it('propagates create-full-spec failures', async () => {
    const dto = { requestId: 'request-1', milestoneCount: 3 } as never;
    const req = { method: 'POST', path: '/project-specs/full-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createFullSpec.mockRejectedValue(new Error('create full spec failed'));

    await expect(controller.createFullSpec(user, dto, req)).rejects.toThrow(
      'create full spec failed',
    );

    expect(projectSpecsService.createFullSpec).toHaveBeenCalledWith(user, dto, req);
  });

  it('updates a full spec through the service', async () => {
    const dto = { title: 'Updated full spec' } as never;
    const req = { method: 'PATCH', path: '/project-specs/spec-9/full-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.updateFullSpec.mockResolvedValue({ id: 'spec-9', title: 'Updated full spec' });

    const result = await controller.updateFullSpec(user, 'spec-9', dto, req);

    expect(projectSpecsService.updateFullSpec).toHaveBeenCalledWith(user, 'spec-9', dto, req);
    expect(result).toEqual({ id: 'spec-9', title: 'Updated full spec' });
  });

  it('propagates update-full-spec failures', async () => {
    const dto = { title: 'Updated full spec' } as never;
    const req = { method: 'PATCH', path: '/project-specs/spec-9/full-spec' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.updateFullSpec.mockRejectedValue(new Error('update full spec failed'));

    await expect(controller.updateFullSpec(user, 'spec-9', dto, req)).rejects.toThrow(
      'update full spec failed',
    );

    expect(projectSpecsService.updateFullSpec).toHaveBeenCalledWith(user, 'spec-9', dto, req);
  });

  it('submits a full spec for final review through the service', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/submit-for-final-review' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.submitForFinalReview.mockResolvedValue({
      id: 'spec-9',
      status: 'FINAL_REVIEW',
    });

    const result = await controller.submitForFinalReview(user, 'spec-9', req);

    expect(projectSpecsService.submitForFinalReview).toHaveBeenCalledWith(user, 'spec-9', req);
    expect(result).toEqual({ id: 'spec-9', status: 'FINAL_REVIEW' });
  });

  it('propagates submit-for-final-review failures', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/submit-for-final-review' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.submitForFinalReview.mockRejectedValue(
      new Error('submit for final review failed'),
    );

    await expect(controller.submitForFinalReview(user, 'spec-9', req)).rejects.toThrow(
      'submit for final review failed',
    );

    expect(projectSpecsService.submitForFinalReview).toHaveBeenCalledWith(user, 'spec-9', req);
  });

  it('routes spec signing to the service', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/sign' } as never;
    const user = { id: 'freelancer-1' } as never;
    projectSpecsService.signSpec.mockResolvedValue({ id: 'spec-9', status: 'SIGNED' });

    const result = await controller.signSpec(user, 'spec-9', req);

    expect(projectSpecsService.signSpec).toHaveBeenCalledWith(user, 'spec-9', req);
    expect(result).toEqual({ id: 'spec-9', status: 'SIGNED' });
  });

  it('propagates sign-spec failures', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/sign' } as never;
    const user = { id: 'freelancer-1' } as never;
    projectSpecsService.signSpec.mockRejectedValue(new Error('sign spec failed'));

    await expect(controller.signSpec(user, 'spec-9', req)).rejects.toThrow('sign spec failed');

    expect(projectSpecsService.signSpec).toHaveBeenCalledWith(user, 'spec-9', req);
  });

  it('routes full-spec change requests to the service', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/request-changes' } as never;
    const user = { id: 'client-1' } as never;
    projectSpecsService.requestFullSpecChanges.mockResolvedValue({
      id: 'spec-9',
      status: 'REJECTED',
      reason: 'Needs revision',
    });

    const result = await controller.requestFullSpecChanges(
      user,
      'spec-9',
      { reason: 'Needs revision' } as never,
      req,
    );

    expect(projectSpecsService.requestFullSpecChanges).toHaveBeenCalledWith(
      user,
      'spec-9',
      'Needs revision',
      req,
    );
    expect(result).toEqual({
      id: 'spec-9',
      status: 'REJECTED',
      reason: 'Needs revision',
    });
  });

  it('propagates request-full-spec-changes failures', async () => {
    const req = { method: 'POST', path: '/project-specs/spec-9/request-changes' } as never;
    const user = { id: 'client-1' } as never;
    projectSpecsService.requestFullSpecChanges.mockRejectedValue(
      new Error('request changes failed'),
    );

    await expect(
      controller.requestFullSpecChanges(user, 'spec-9', { reason: 'Needs revision' } as never, req),
    ).rejects.toThrow('request changes failed');

    expect(projectSpecsService.requestFullSpecChanges).toHaveBeenCalledWith(
      user,
      'spec-9',
      'Needs revision',
      req,
    );
  });

  it('routes legacy create requests to createSpec', async () => {
    const dto = { requestId: 'request-1', name: 'Legacy spec' } as never;
    const req = { method: 'POST', path: '/project-specs' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createSpec.mockResolvedValue({ id: 'spec-10', specPhase: 'FULL_SPEC' });

    const result = await controller.create(user, dto, req);

    expect(projectSpecsService.createSpec).toHaveBeenCalledWith(user, dto, req);
    expect(result).toEqual({ id: 'spec-10', specPhase: 'FULL_SPEC' });
  });

  it('propagates legacy create-spec failures', async () => {
    const dto = { requestId: 'request-1', name: 'Legacy spec' } as never;
    const req = { method: 'POST', path: '/project-specs' } as never;
    const user = { id: 'broker-1' } as never;
    projectSpecsService.createSpec.mockRejectedValue(new Error('legacy create failed'));

    await expect(controller.create(user, dto, req)).rejects.toThrow('legacy create failed');

    expect(projectSpecsService.createSpec).toHaveBeenCalledWith(user, dto, req);
  });

  it('routes APPROVE actions to approveSpec', async () => {
    projectSpecsService.approveSpec.mockResolvedValue({
      id: 'spec-1',
      status: 'APPROVED',
    });

    const user = { id: 'staff-1' } as never;
    const req = { method: 'POST', path: '/project-specs/spec-1/audit' } as never;

    const result = await controller.auditSpec(
      user,
      'spec-1',
      { action: AuditAction.APPROVE },
      req,
    );

    expect(projectSpecsService.approveSpec).toHaveBeenCalledWith(user, 'spec-1', req);
    expect(projectSpecsService.rejectSpec).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'spec-1', status: 'APPROVED' });
  });

  it('routes REJECT actions with a reason to rejectSpec', async () => {
    projectSpecsService.rejectSpec.mockResolvedValue({
      id: 'spec-1',
      status: 'REJECTED',
      reason: 'Missing acceptance criteria',
    });

    const user = { id: 'staff-1' } as never;
    const req = { method: 'POST', path: '/project-specs/spec-1/audit' } as never;

    const result = await controller.auditSpec(
      user,
      'spec-1',
      { action: AuditAction.REJECT, reason: 'Missing acceptance criteria' },
      req,
    );

    expect(projectSpecsService.rejectSpec).toHaveBeenCalledWith(
      user,
      'spec-1',
      'Missing acceptance criteria',
      req,
    );
    expect(projectSpecsService.approveSpec).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'spec-1',
      status: 'REJECTED',
      reason: 'Missing acceptance criteria',
    });
  });

  it('rejects REJECT actions without a reason before calling the service', async () => {
    await expect(
      controller.auditSpec(
        { id: 'staff-1' } as never,
        'spec-1',
        { action: AuditAction.REJECT },
        { method: 'POST', path: '/project-specs/spec-1/audit' } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(projectSpecsService.approveSpec).not.toHaveBeenCalled();
    expect(projectSpecsService.rejectSpec).not.toHaveBeenCalled();
  });
});
