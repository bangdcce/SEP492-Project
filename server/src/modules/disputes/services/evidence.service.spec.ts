import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeActivityEntity,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeHearingEntity,
  DisputePartyEntity,
} from 'src/database/entities';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let service: EvidenceService;

  const repoMock = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: getRepositoryToken(DisputeEvidenceEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputePartyEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeActivityEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SUPABASE_URL') return 'https://mock.supabase.co';
              if (key === 'SUPABASE_SERVICE_KEY') return 'mock-service-key';
              return undefined;
            }),
          },
        },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(EvidenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFileUpload', () => {
    it('accepts valid png file', () => {
      const result = service.validateFileUpload('proof.png', 1024 * 1024, 'image/png');
      expect(result.isValid).toBe(true);
    });

    it('rejects unsupported file type', () => {
      const result = service.validateFileUpload('virus.exe', 1000, 'application/x-msdownload');
      expect(result.isValid).toBe(false);
    });
  });
});
