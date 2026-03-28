import { BadRequestException } from '@nestjs/common';
jest.mock('./project-requests.service', () => ({
  ProjectRequestsService: class ProjectRequestsService {},
}));
import { ProjectRequestsController } from './project-requests.controller';

describe('ProjectRequestsController', () => {
  let controller: ProjectRequestsController;
  let projectRequestsService: {
    create: jest.Mock;
  };

  beforeEach(() => {
    projectRequestsService = {
      create: jest.fn(),
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
});
