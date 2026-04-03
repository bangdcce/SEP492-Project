import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

import { UserRole } from '../../database/entities/user.entity';
import { ProjectsController } from './projects.controller';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: Record<string, jest.Mock>;

  beforeEach(() => {
    projectsService = {
      requestMilestoneReview: jest.fn(),
      reviewMilestoneAsBroker: jest.fn(),
      approveMilestone: jest.fn(),
    };

    controller = new ProjectsController(projectsService as any);
  });

  describe('requestMilestoneReview', () => {
    it('UC35-REQUESTREVIEW-UTCID01 forwards freelancer review requests to ProjectsService.requestMilestoneReview', async () => {
      const milestone = {
        id: 'milestone-1',
        status: 'PENDING_STAFF_REVIEW',
        submittedAt: new Date('2026-03-29T08:00:00.000Z'),
      };
      projectsService.requestMilestoneReview.mockResolvedValue(milestone);

      await expect(
        controller.requestMilestoneReview('milestone-1', {
          user: { id: 'freelancer-1', role: UserRole.FREELANCER },
        } as any),
      ).resolves.toEqual(milestone);
      expect(projectsService.requestMilestoneReview).toHaveBeenCalledWith(
        'milestone-1',
        'freelancer-1',
      );
    });

    it('UC35-REQUESTREVIEW-UTCID02 rejects requests without an authenticated user', async () => {
      await expect(controller.requestMilestoneReview('milestone-1', {} as any)).rejects.toThrow(
        new BadRequestException('User authentication required'),
      );
      expect(projectsService.requestMilestoneReview).not.toHaveBeenCalled();
    });

    it('UC35-REQUESTREVIEW-UTCID03 rejects non-freelancer users before reaching the service', async () => {
      await expect(
        controller.requestMilestoneReview('milestone-1', {
          user: { id: 'client-1', role: UserRole.CLIENT },
        } as any),
      ).rejects.toThrow(
        new ForbiddenException('Only the assigned freelancer can request milestone review'),
      );
      expect(projectsService.requestMilestoneReview).not.toHaveBeenCalled();
    });

    it('UC35-REQUESTREVIEW-UTCID04 propagates service-layer milestone review conflicts', async () => {
      projectsService.requestMilestoneReview.mockRejectedValue(
        new ConflictException('Milestone is already pending review'),
      );

      await expect(
        controller.requestMilestoneReview('milestone-1', {
          user: { id: 'freelancer-1', role: UserRole.FREELANCER },
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(projectsService.requestMilestoneReview).toHaveBeenCalledWith(
        'milestone-1',
        'freelancer-1',
      );
    });
  });

  describe('reviewMilestoneAsStaffCompatibilityAlias', () => {
    it('UC106-STAFFREVIEW-UTCID01 keeps the compatibility alias but delegates to broker review logic', async () => {
      const milestone = {
        id: 'milestone-1',
        status: 'PENDING_CLIENT_APPROVAL',
        reviewedByStaffId: 'broker-1',
      };
      const dto = {
        recommendation: 'ACCEPT',
        note: 'Broker review passed.',
      };
      projectsService.reviewMilestoneAsBroker.mockResolvedValue(milestone);

      await expect(
        controller.reviewMilestoneAsStaffCompatibilityAlias('milestone-1', dto as any, {
          user: { id: 'broker-1', role: UserRole.BROKER },
        } as any),
      ).resolves.toEqual(milestone);
      expect(projectsService.reviewMilestoneAsBroker).toHaveBeenCalledWith(
        'milestone-1',
        'broker-1',
        dto,
      );
    });

    it('UC106-STAFFREVIEW-UTCID02 rejects compatibility-alias requests without authentication', async () => {
      await expect(
        controller.reviewMilestoneAsStaffCompatibilityAlias(
          'milestone-1',
          { recommendation: 'ACCEPT', note: 'ok' } as any,
          {} as any,
        ),
      ).rejects.toThrow(new BadRequestException('User authentication required'));
      expect(projectsService.reviewMilestoneAsBroker).not.toHaveBeenCalled();
    });

    it('UC106-STAFFREVIEW-UTCID03 rejects users who are not broker/admin reviewers', async () => {
      await expect(
        controller.reviewMilestoneAsStaffCompatibilityAlias(
          'milestone-1',
          { recommendation: 'ACCEPT', note: 'ok' } as any,
          {
            user: { id: 'staff-1', role: UserRole.STAFF },
          } as any,
        ),
      ).rejects.toThrow(
        new ForbiddenException('Only broker users can review milestones'),
      );
      expect(projectsService.reviewMilestoneAsBroker).not.toHaveBeenCalled();
    });

    it('UC106-STAFFREVIEW-UTCID04 also allows admin users through the compatibility alias', async () => {
      const milestone = {
        id: 'milestone-1',
        status: 'PENDING_CLIENT_APPROVAL',
        reviewedByStaffId: 'admin-1',
      };
      const dto = {
        recommendation: 'REJECT',
        note: 'Need stronger delivery evidence.',
      };
      projectsService.reviewMilestoneAsBroker.mockResolvedValue(milestone);

      await expect(
        controller.reviewMilestoneAsStaffCompatibilityAlias('milestone-1', dto as any, {
          user: { id: 'admin-1', role: UserRole.ADMIN },
        } as any),
      ).resolves.toEqual(milestone);
      expect(projectsService.reviewMilestoneAsBroker).toHaveBeenCalledWith(
        'milestone-1',
        'admin-1',
        dto,
      );
    });
  });

  describe('approveMilestone', () => {
    it('UC35-APPROVE-UTCID01 forwards client approvals with audit request context and returns the service result', async () => {
      const result = {
        fundsReleased: true,
        milestone: { id: 'milestone-1', status: 'PAID' },
        message: 'Funds have been released to the project team.',
      };
      projectsService.approveMilestone.mockResolvedValue(result);

      await expect(
        controller.approveMilestone(
          'milestone-1',
          { feedback: 'Looks good' } as any,
          {
            user: { id: 'client-1', role: UserRole.CLIENT },
            ip: '127.0.0.1',
            method: 'POST',
            path: '/projects/milestones/milestone-1/approve',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
          } as any,
        ),
      ).resolves.toEqual(result);
      expect(projectsService.approveMilestone).toHaveBeenCalledWith(
        'milestone-1',
        'client-1',
        'Looks good',
        {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          method: 'POST',
          path: '/projects/milestones/milestone-1/approve',
        },
      );
    });

    it('UC35-APPROVE-UTCID02 rejects requests without an authenticated user before calling the service', async () => {
      await expect(
        controller.approveMilestone(
          'milestone-1',
          { feedback: 'Looks good' } as any,
          {
            get: jest.fn(),
          } as any,
        ),
      ).rejects.toThrow(
        new BadRequestException('User authentication required to approve milestone'),
      );
      expect(projectsService.approveMilestone).not.toHaveBeenCalled();
    });

    it('UC35-APPROVE-UTCID03 preserves expected HTTP failures from the service layer', async () => {
      projectsService.approveMilestone.mockRejectedValue(
        new ConflictException('Cannot approve milestone while the project is under dispute'),
      );

      await expect(
        controller.approveMilestone(
          'milestone-1',
          { feedback: 'Looks good' } as any,
          {
            user: { id: 'client-1', role: UserRole.CLIENT },
            ip: '127.0.0.1',
            method: 'POST',
            path: '/projects/milestones/milestone-1/approve',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
          } as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('UC35-APPROVE-UTCID04 wraps unexpected approval failures in InternalServerErrorException', async () => {
      projectsService.approveMilestone.mockRejectedValue(new Error('wallet service offline'));

      await expect(
        controller.approveMilestone(
          'milestone-1',
          { feedback: 'Looks good' } as any,
          {
            user: { id: 'client-1', role: UserRole.CLIENT },
            ip: '127.0.0.1',
            method: 'POST',
            path: '/projects/milestones/milestone-1/approve',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
          } as any,
        ),
      ).rejects.toThrow(new InternalServerErrorException('Failed to approve milestone'));
    });

    it('UC35-APPROVE-UTCID05 forwards undefined feedback when the client approves without additional comments', async () => {
      const result = {
        fundsReleased: true,
        milestone: { id: 'milestone-1', status: 'PAID' },
        message: 'Funds released without additional client feedback.',
      };
      projectsService.approveMilestone.mockResolvedValue(result);

      await expect(
        controller.approveMilestone(
          'milestone-1',
          {} as any,
          {
            user: { id: 'client-1', role: UserRole.CLIENT },
            ip: '127.0.0.1',
            method: 'POST',
            path: '/projects/milestones/milestone-1/approve',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
          } as any,
        ),
      ).resolves.toEqual(result);
      expect(projectsService.approveMilestone).toHaveBeenCalledWith(
        'milestone-1',
        'client-1',
        undefined,
        {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          method: 'POST',
          path: '/projects/milestones/milestone-1/approve',
        },
      );
    });
  });
});
