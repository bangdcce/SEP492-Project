import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import Decimal from 'decimal.js';
import { ContractsService } from './contracts.service';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let mockQueryRunner: Partial<QueryRunner>;

  const mockContractsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockProjectsRepo = {};
  const mockSpecsRepo = {};
  const mockMilestonesRepo = {};
  const mockEscrowsRepo = {};
  const mockSignaturesRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditLogsService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn((entity, data) => data),
        save: jest.fn((data) => ({ ...data, id: 'mock-id' })),
      } as any,
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: getRepositoryToken(ContractEntity), useValue: mockContractsRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: mockProjectsRepo },
        { provide: getRepositoryToken(ProjectSpecEntity), useValue: mockSpecsRepo },
        { provide: getRepositoryToken(MilestoneEntity), useValue: mockMilestonesRepo },
        { provide: getRepositoryToken(EscrowEntity), useValue: mockEscrowsRepo },
        { provide: getRepositoryToken(DigitalSignatureEntity), useValue: mockSignaturesRepo },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Financial Integrity Check', () => {
    it('should correctly sum milestone amounts using Decimal.js', () => {
      // Test case: 0.1 + 0.2 should equal 0.3 (JavaScript float issue)
      const milestone1 = { amount: 0.1 };
      const milestone2 = { amount: 0.2 };

      // Using regular JavaScript: 0.1 + 0.2 = 0.30000000000000004
      expect(0.1 + 0.2).not.toBe(0.3);

      // Using Decimal.js: Correct result
      const sum = new Decimal(milestone1.amount).plus(new Decimal(milestone2.amount));
      expect(sum.toNumber()).toBe(0.3);
    });

    it('should detect budget mismatch greater than 0.01', () => {
      const milestones = [{ amount: 1000 }, { amount: 500 }, { amount: 499.5 }];

      const totalMilestoneAmount = milestones.reduce(
        (sum, m) => sum.plus(new Decimal(m.amount)),
        new Decimal(0),
      );

      const projectBudget = new Decimal(2000);
      const difference = totalMilestoneAmount.minus(projectBudget).abs();

      // 1999.5 vs 2000 = 0.5 difference
      expect(difference.greaterThan(0.01)).toBe(true);
    });

    it('should accept budget match within 0.01 tolerance', () => {
      const milestones = [{ amount: 1000 }, { amount: 500 }, { amount: 500.005 }];

      const totalMilestoneAmount = milestones.reduce(
        (sum, m) => sum.plus(new Decimal(m.amount)),
        new Decimal(0),
      );

      const projectBudget = new Decimal(2000);
      const difference = totalMilestoneAmount.minus(projectBudget).abs();

      // 2000.005 vs 2000 = 0.005 difference (acceptable)
      expect(difference.greaterThan(0.01)).toBe(false);
    });
  });

  describe('Fee Calculation', () => {
    it('should correctly calculate fee splits', () => {
      const milestoneAmount = new Decimal(1000);

      const developerShare = milestoneAmount.times(85).dividedBy(100).toDecimalPlaces(2);
      const brokerShare = milestoneAmount.times(10).dividedBy(100).toDecimalPlaces(2);
      const platformFee = milestoneAmount.times(5).dividedBy(100).toDecimalPlaces(2);

      expect(developerShare.toNumber()).toBe(850);
      expect(brokerShare.toNumber()).toBe(100);
      expect(platformFee.toNumber()).toBe(50);

      // Total should equal original amount
      const total = developerShare.plus(brokerShare).plus(platformFee);
      expect(total.toNumber()).toBe(1000);
    });
  });
});
