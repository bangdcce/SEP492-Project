import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeActivityEntity,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeHearingEntity,
  DisputeLedgerEntity,
  DisputeMessageEntity,
  DisputeNoteEntity,
  DisputePartyEntity,
  DisputeScheduleProposalEntity,
  DisputeVerdictEntity,
  DisputeViewStateEntity,
  EscrowEntity,
  EventParticipantEntity,
  HearingParticipantEntity,
  HearingQuestionEntity,
  MilestoneEntity,
  ProjectEntity,
  TaskEntity,
  TransactionEntity,
  UserEntity,
  WalletEntity,
} from 'src/database/entities';
import { DataSource } from 'typeorm';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserWarningService } from '../user-warning/user-warning.service';
import { SettlementService } from './services/settlement.service';
import { HearingService } from './services/hearing.service';
import { VerdictService } from './services/verdict.service';
import { StaffAssignmentService } from './services/staff-assignment.service';
import { CalendarService } from '../calendar/calendar.service';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  let service: DisputesService;

  const repoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: getRepositoryToken(MilestoneEntity), useValue: repoMock() },
        { provide: getRepositoryToken(TaskEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEvidenceEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeMessageEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingParticipantEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingQuestionEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeVerdictEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EscrowEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: getRepositoryToken(WalletEntity), useValue: repoMock() },
        { provide: getRepositoryToken(TransactionEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeNoteEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeActivityEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeLedgerEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputePartyEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeScheduleProposalEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeViewStateEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EventParticipantEntity), useValue: repoMock() },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: TrustScoreService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: UserWarningService, useValue: {} },
        { provide: SettlementService, useValue: {} },
        { provide: HearingService, useValue: {} },
        { provide: VerdictService, useValue: {} },
        { provide: StaffAssignmentService, useValue: {} },
        { provide: CalendarService, useValue: {} },
      ],
    }).compile();

    service = module.get(DisputesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
