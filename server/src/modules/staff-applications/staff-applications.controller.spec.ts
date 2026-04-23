import { StaffApplicationStatus } from '../../database/entities/staff-application.entity';
import { StaffApplicationsController } from './staff-applications.controller';

describe('StaffApplicationsController', () => {
  let controller: StaffApplicationsController;
  let staffApplicationsService: {
    getMyApplication: jest.Mock;
    getAllApplications: jest.Mock;
    getApplicationById: jest.Mock;
    getApplicationReviewAssets: jest.Mock;
    approveApplication: jest.Mock;
    rejectApplication: jest.Mock;
  };

  beforeEach(() => {
    staffApplicationsService = {
      getMyApplication: jest.fn().mockResolvedValue({
        id: 'application-1',
        status: StaffApplicationStatus.PENDING,
      }),
      getAllApplications: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      getApplicationById: jest.fn().mockResolvedValue({
        id: 'application-1',
        status: StaffApplicationStatus.PENDING,
      }),
      getApplicationReviewAssets: jest.fn().mockResolvedValue({
        id: 'application-1',
        status: StaffApplicationStatus.PENDING,
        cv: { url: 'https://files.example.com/cv.pdf' },
      }),
      approveApplication: jest.fn().mockResolvedValue({
        id: 'application-1',
        status: StaffApplicationStatus.APPROVED,
      }),
      rejectApplication: jest.fn().mockResolvedValue({
        id: 'application-1',
        status: StaffApplicationStatus.REJECTED,
      }),
    };

    controller = new StaffApplicationsController(staffApplicationsService as any);
  });

  it('returns the current user application status', async () => {
    const result = await controller.getMyApplication('staff-1');

    expect(staffApplicationsService.getMyApplication).toHaveBeenCalledWith('staff-1');
    expect(result).toEqual({
      id: 'application-1',
      status: StaffApplicationStatus.PENDING,
    });
  });

  it('forwards list filters to the service', async () => {
    const query = {
      status: StaffApplicationStatus.PENDING,
      search: 'staff',
      page: 2,
      limit: 10,
    };

    await controller.getApplications(query);

    expect(staffApplicationsService.getAllApplications).toHaveBeenCalledWith(query);
  });

  it('forwards admin review-asset requests to the service with reviewer context', async () => {
    const result = await controller.getApplicationReviewAssets(
      'application-1',
      {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN' as any,
      },
      {
        ip: '203.0.113.10',
        headers: {
          'user-agent': 'Jest',
          'x-request-id': 'trace-1',
        },
      } as any,
    );

    expect(staffApplicationsService.getApplicationReviewAssets).toHaveBeenCalledWith(
      'application-1',
      {
        reviewerId: 'admin-1',
        reviewerEmail: 'admin@example.com',
        reviewerRole: 'ADMIN',
        ipAddress: '203.0.113.10',
        userAgent: 'Jest',
        sessionId: 'trace-1',
      },
    );
    expect(result).toEqual({
      id: 'application-1',
      status: StaffApplicationStatus.PENDING,
      cv: { url: 'https://files.example.com/cv.pdf' },
    });
  });

  it('approves and rejects applications via the service', async () => {
    await controller.approveApplication('application-1', 'admin-1');
    await controller.rejectApplication(
      'application-1',
      { rejectionReason: 'Missing experience' },
      'admin-1',
    );

    expect(staffApplicationsService.approveApplication).toHaveBeenCalledWith(
      'application-1',
      'admin-1',
    );
    expect(staffApplicationsService.rejectApplication).toHaveBeenCalledWith(
      'application-1',
      'admin-1',
      { rejectionReason: 'Missing experience' },
    );
  });
});
