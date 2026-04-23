import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliverableType } from '../../database/entities/milestone.entity';
import { UserRole } from '../../database/entities/user.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  const projectsService = {
    listByUser: jest.fn(),
    createMilestone: jest.fn(),
    updateMilestoneStructure: jest.fn(),
    deleteMilestoneStructure: jest.fn(),
  };

  const buildRequest = (user?: { id: string; role?: UserRole | string }) =>
    ({ user } as never);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: projectsService,
        },
      ],
    }).compile();

    controller = module.get(ProjectsController);
  });

  describe('listByUser', () => {
    it('returns the requested user project list when the caller owns the list', async () => {
      projectsService.listByUser.mockResolvedValue([{ id: 'project-1' }]);
      const req = buildRequest({ id: 'user-1', role: UserRole.CLIENT });

      const result = await controller.listByUser('user-1', req);

      expect(projectsService.listByUser).toHaveBeenCalledWith('user-1', 'user-1');
      expect(result).toEqual([{ id: 'project-1' }]);
    });

    it('allows admin users to read another user project list', async () => {
      projectsService.listByUser.mockResolvedValue([{ id: 'project-2' }]);
      const req = buildRequest({ id: 'admin-1', role: UserRole.ADMIN });

      const result = await controller.listByUser('user-2', req);

      expect(projectsService.listByUser).toHaveBeenCalledWith('user-2', 'admin-1');
      expect(result).toEqual([{ id: 'project-2' }]);
    });

    it('rejects non-owner callers before touching the service', async () => {
      const req = buildRequest({ id: 'broker-1', role: UserRole.BROKER });

      expect(() => controller.listByUser('user-2', req)).toThrow(ForbiddenException);
      expect(projectsService.listByUser).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated callers before touching the service', async () => {
      const req = buildRequest();

      expect(() => controller.listByUser('user-2', req)).toThrow(BadRequestException);
      expect(projectsService.listByUser).not.toHaveBeenCalled();
    });
  });

  describe('createMilestone', () => {
    it('delegates milestone creation with the authenticated user and mapped payload', async () => {
      const payload = {
        title: 'Phase 1',
        description: 'Discovery milestone',
        amount: 1000,
        startDate: '2026-03-31',
        dueDate: '2026-04-15',
        sortOrder: 1,
        deliverableType: DeliverableType.API_DOCS,
        retentionAmount: 100,
        acceptanceCriteria: ['Signed kickoff scope'],
      };
      projectsService.createMilestone.mockResolvedValue({
        id: 'milestone-1',
        ...payload,
      });

      const req = buildRequest({ id: 'client-1', role: UserRole.CLIENT });
      const result = await controller.createMilestone('project-1', payload, req);

      expect(projectsService.createMilestone).toHaveBeenCalledWith('project-1', 'client-1', {
        title: 'Phase 1',
        description: 'Discovery milestone',
        amount: 1000,
        startDate: '2026-03-31',
        dueDate: '2026-04-15',
        sortOrder: 1,
        deliverableType: DeliverableType.API_DOCS,
        retentionAmount: 100,
        acceptanceCriteria: ['Signed kickoff scope'],
      });
      expect(result).toEqual({ id: 'milestone-1', ...payload });
    });

    it('rejects milestone creation when the caller is not authenticated', async () => {
      await expect(
        controller.createMilestone(
          'project-1',
          {
            title: 'Phase 1',
          } as never,
          buildRequest(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(projectsService.createMilestone).not.toHaveBeenCalled();
    });
  });

  describe('updateMilestone', () => {
    it('delegates milestone updates with the authenticated user and mapped payload', async () => {
      const payload = {
        title: 'Updated milestone',
        description: null,
        amount: 1500,
        startDate: null,
        dueDate: '2026-05-01',
        sortOrder: 2,
        deliverableType: DeliverableType.SOURCE_CODE,
        retentionAmount: null,
        acceptanceCriteria: ['Revised scope approved'],
      };
      projectsService.updateMilestoneStructure.mockResolvedValue({
        id: 'milestone-2',
        ...payload,
      });

      const req = buildRequest({ id: 'broker-1', role: UserRole.BROKER });
      const result = await controller.updateMilestone('milestone-2', payload, req);

      expect(projectsService.updateMilestoneStructure).toHaveBeenCalledWith('milestone-2', 'broker-1', {
        title: 'Updated milestone',
        description: null,
        amount: 1500,
        startDate: null,
        dueDate: '2026-05-01',
        sortOrder: 2,
        deliverableType: DeliverableType.SOURCE_CODE,
        retentionAmount: null,
        acceptanceCriteria: ['Revised scope approved'],
      });
      expect(result).toEqual({ id: 'milestone-2', ...payload });
    });

    it('rejects milestone updates when the caller is not authenticated', async () => {
      await expect(
        controller.updateMilestone(
          'milestone-2',
          {
            title: 'Updated milestone',
          } as never,
          buildRequest(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(projectsService.updateMilestoneStructure).not.toHaveBeenCalled();
    });
  });

  describe('deleteMilestone', () => {
    it('deletes a milestone and returns success for an authenticated caller', async () => {
      projectsService.deleteMilestoneStructure.mockResolvedValue(undefined);
      const req = buildRequest({ id: 'client-1', role: UserRole.CLIENT });

      const result = await controller.deleteMilestone('milestone-3', req);

      expect(projectsService.deleteMilestoneStructure).toHaveBeenCalledWith('milestone-3', 'client-1');
      expect(result).toEqual({ success: true });
    });

    it('rejects milestone deletion when the caller is not authenticated', async () => {
      await expect(controller.deleteMilestone('milestone-3', buildRequest())).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(projectsService.deleteMilestoneStructure).not.toHaveBeenCalled();
    });
  });
});
