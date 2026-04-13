import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

describe('ContractsController', () => {
  let controller: ContractsController;

  const contractsService = {
    listByUser: jest.fn(),
    findOneForUser: jest.fn(),
    initializeProjectAndContract: jest.fn(),
    signContract: jest.fn(),
    updateDraft: jest.fn(),
    sendDraft: jest.fn(),
    discardDraft: jest.fn(),
    activateProject: jest.fn(),
    generatePdfForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        {
          provide: ContractsService,
          useValue: contractsService,
        },
      ],
    }).compile();

    controller = module.get(ContractsController);
  });

  it('returns the authenticated user contract list', async () => {
    contractsService.listByUser.mockResolvedValue([
      { id: 'contract-1', projectId: 'project-1', status: 'DRAFT' },
    ]);

    const result = await controller.listContracts({ id: 'user-1' } as never);

    expect(contractsService.listByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'contract-1', projectId: 'project-1', status: 'DRAFT' }]);
  });

  it('returns an empty array when the user has no contracts', async () => {
    contractsService.listByUser.mockResolvedValue([]);

    const result = await controller.listContracts({ id: 'user-1' } as never);

    expect(contractsService.listByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });

  it('propagates service errors from listByUser', async () => {
    const error = new Error('database unavailable');
    contractsService.listByUser.mockRejectedValue(error);

    await expect(controller.listContracts({ id: 'user-1' } as never)).rejects.toThrow(error);
    expect(contractsService.listByUser).toHaveBeenCalledWith('user-1');
  });

  it('returns a single contract for the authenticated user', async () => {
    contractsService.findOneForUser.mockResolvedValue({
      id: 'contract-1',
      status: 'DRAFT',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.getContract(user, 'contract-1');

    expect(contractsService.findOneForUser).toHaveBeenCalledWith(user, 'contract-1');
    expect(result).toEqual({
      id: 'contract-1',
      status: 'DRAFT',
    });
  });

  it('propagates service errors from getContract', async () => {
    const error = new Error('contract lookup failed');
    contractsService.findOneForUser.mockRejectedValue(error);

    await expect(controller.getContract({ id: 'user-1' } as never, 'contract-1')).rejects.toThrow(
      error,
    );
    expect(contractsService.findOneForUser).toHaveBeenCalledWith(
      { id: 'user-1' },
      'contract-1',
    );
  });

  it('initializes a contract with body dto including freelancerId', async () => {
    contractsService.initializeProjectAndContract.mockResolvedValue({
      id: 'contract-1',
      specId: 'spec-1',
      freelancerId: 'freelancer-1',
    });

    const user = { id: 'user-1' } as never;
    const dto = { specId: 'spec-1', freelancerId: 'freelancer-1' };
    const result = await controller.initializeContractWithBody(user, dto);

    expect(contractsService.initializeProjectAndContract).toHaveBeenCalledWith(
      user,
      'spec-1',
      'freelancer-1',
    );
    expect(result).toEqual({
      id: 'contract-1',
      specId: 'spec-1',
      freelancerId: 'freelancer-1',
    });
  });

  it('initializes a contract with body dto when freelancerId is omitted', async () => {
    contractsService.initializeProjectAndContract.mockResolvedValue({
      id: 'contract-1',
      specId: 'spec-1',
      freelancerId: null,
    });

    const user = { id: 'user-1' } as never;
    const dto = { specId: 'spec-1' };
    const result = await controller.initializeContractWithBody(user, dto);

    expect(contractsService.initializeProjectAndContract).toHaveBeenCalledWith(
      user,
      'spec-1',
      undefined,
    );
    expect(result).toEqual({
      id: 'contract-1',
      specId: 'spec-1',
      freelancerId: null,
    });
  });

  it('propagates initialization errors from initializeContractWithBody', async () => {
    const error = new Error('initialize with body failed');
    contractsService.initializeProjectAndContract.mockRejectedValue(error);

    await expect(
      controller.initializeContractWithBody({ id: 'user-1' } as never, { specId: 'spec-1' }),
    ).rejects.toThrow(error);
    expect(contractsService.initializeProjectAndContract).toHaveBeenCalledWith(
      { id: 'user-1' },
      'spec-1',
      undefined,
    );
  });

  it('initializes a contract from the specId path parameter', async () => {
    contractsService.initializeProjectAndContract.mockResolvedValue({
      id: 'contract-2',
      specId: 'spec-2',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.initializeContract(user, 'spec-2');

    expect(contractsService.initializeProjectAndContract).toHaveBeenCalledWith(user, 'spec-2');
    expect(result).toEqual({
      id: 'contract-2',
      specId: 'spec-2',
    });
  });

  it('propagates initialization errors from initializeContract', async () => {
    const error = new Error('initialize from param failed');
    contractsService.initializeProjectAndContract.mockRejectedValue(error);

    await expect(controller.initializeContract({ id: 'user-1' } as never, 'spec-2')).rejects.toThrow(
      error,
    );
    expect(contractsService.initializeProjectAndContract).toHaveBeenCalledWith(
      { id: 'user-1' },
      'spec-2',
    );
  });

  it('signs a contract using the supplied content hash and request context', async () => {
    contractsService.signContract.mockResolvedValue({
      id: 'contract-1',
      status: 'SIGNED',
    });

    const user = { id: 'user-1' } as never;
    const req = { ip: '127.0.0.1', path: '/contracts/sign/contract-1' } as never;
    const dto = { contentHash: '0123456789abcdef0123456789abcdef' };
    const result = await controller.signContract(user, req, 'contract-1', dto);

    expect(contractsService.signContract).toHaveBeenCalledWith(
      user,
      'contract-1',
      dto.contentHash,
      req,
    );
    expect(result).toEqual({
      id: 'contract-1',
      status: 'SIGNED',
    });
  });

  it('propagates service errors from signContract', async () => {
    const error = new Error('sign failed');
    contractsService.signContract.mockRejectedValue(error);

    await expect(
      controller.signContract(
        { id: 'user-1' } as never,
        { ip: '127.0.0.1' } as never,
        'contract-1',
        { contentHash: '0123456789abcdef0123456789abcdef' },
      ),
    ).rejects.toThrow(error);
  });

  it('updates a contract draft with the provided dto', async () => {
    contractsService.updateDraft.mockResolvedValue({
      id: 'contract-1',
      title: 'Updated contract',
    });

    const user = { id: 'user-1' } as never;
    const dto = {
      title: 'Updated contract',
      currency: 'USD',
      milestoneSnapshot: [
        {
          title: 'Phase 1',
          amount: 100,
        },
      ],
    };
    const result = await controller.updateDraft(user, 'contract-1', dto as never);

    expect(contractsService.updateDraft).toHaveBeenCalledWith(user, 'contract-1', dto);
    expect(result).toEqual({
      id: 'contract-1',
      title: 'Updated contract',
    });
  });

  it('propagates service errors from updateDraft', async () => {
    const error = new Error('draft update failed');
    contractsService.updateDraft.mockRejectedValue(error);

    await expect(
      controller.updateDraft({ id: 'user-1' } as never, 'contract-1', { title: 'Draft' } as never),
    ).rejects.toThrow(error);
  });

  it('sends a draft contract', async () => {
    contractsService.sendDraft.mockResolvedValue({
      id: 'contract-1',
      status: 'SENT',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.sendDraft(user, 'contract-1');

    expect(contractsService.sendDraft).toHaveBeenCalledWith(user, 'contract-1');
    expect(result).toEqual({
      id: 'contract-1',
      status: 'SENT',
    });
  });

  it('propagates service errors from sendDraft', async () => {
    const error = new Error('send draft failed');
    contractsService.sendDraft.mockRejectedValue(error);

    await expect(controller.sendDraft({ id: 'user-1' } as never, 'contract-1')).rejects.toThrow(
      error,
    );
  });

  it('discards a draft contract', async () => {
    contractsService.discardDraft.mockResolvedValue({
      id: 'contract-1',
      status: 'DISCARDED',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.discardDraft(user, 'contract-1');

    expect(contractsService.discardDraft).toHaveBeenCalledWith(user, 'contract-1');
    expect(result).toEqual({
      id: 'contract-1',
      status: 'DISCARDED',
    });
  });

  it('propagates service errors from discardDraft', async () => {
    const error = new Error('discard failed');
    contractsService.discardDraft.mockRejectedValue(error);

    await expect(
      controller.discardDraft({ id: 'user-1' } as never, 'contract-1'),
    ).rejects.toThrow(error);
  });

  it('activates a project from an accepted contract', async () => {
    contractsService.activateProject.mockResolvedValue({
      id: 'project-1',
      contractId: 'contract-1',
      status: 'ACTIVE',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.activateProject(user, 'contract-1');

    expect(contractsService.activateProject).toHaveBeenCalledWith(user, 'contract-1');
    expect(result).toEqual({
      id: 'project-1',
      contractId: 'contract-1',
      status: 'ACTIVE',
    });
  });

  it('propagates service errors from activateProject', async () => {
    const error = new Error('activate failed');
    contractsService.activateProject.mockRejectedValue(error);

    await expect(
      controller.activateProject({ id: 'user-1' } as never, 'contract-1'),
    ).rejects.toThrow(error);
  });

  it('streams the generated contract pdf with attachment headers', async () => {
    const buffer = Buffer.from('pdf-data');
    contractsService.generatePdfForUser.mockResolvedValue(buffer);

    const res = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.downloadPdf({ id: 'user-1' } as never, 'contract-1', res);

    expect(contractsService.generatePdfForUser).toHaveBeenCalledWith(
      { id: 'user-1' },
      'contract-1',
    );
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=contract-contract-1.pdf',
      'Content-Length': buffer.length,
    });
    expect(res.end).toHaveBeenCalledWith(buffer);
  });

  it('propagates service errors from downloadPdf before writing the response', async () => {
    const error = new Error('pdf generation failed');
    contractsService.generatePdfForUser.mockRejectedValue(error);
    const res = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await expect(
      controller.downloadPdf({ id: 'user-1' } as never, 'contract-1', res),
    ).rejects.toThrow(error);
    expect(res.set).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});
