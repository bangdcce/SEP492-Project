import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRequestsService } from './project-requests.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectRequestEntity, RequestStatus } from '../../database/entities/project-request.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProjectRequestsService', () => {
  let service: ProjectRequestsService;
  let repositoryMock: any;

  const mockProjectRequestRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAuditLogsService = {
    logCustom: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRequestsService,
        {
          provide: getRepositoryToken(ProjectRequestEntity),
          useValue: mockProjectRequestRepository,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProjectRequestsService>(ProjectRequestsService);
    repositoryMock = module.get(getRepositoryToken(ProjectRequestEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    const requestId = 'req-1';

    // Mock Users
    const clientA: UserEntity = { id: 'client-a', role: UserRole.CLIENT } as any;
    const clientB: UserEntity = { id: 'client-b', role: UserRole.CLIENT } as any;
    const admin: UserEntity = { id: 'admin', role: UserRole.ADMIN } as any;
    const brokerMe: UserEntity = { id: 'broker-me', role: UserRole.BROKER } as any;
    const brokerOther: UserEntity = { id: 'broker-other', role: UserRole.BROKER } as any;

    it('should throw NotFoundException if request does not exist', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', clientA)).rejects.toThrow(NotFoundException);
    });

    it('should allow Admin to view any request', async () => {
      const request = { id: requestId, clientId: 'client-b' } as ProjectRequestEntity;
      repositoryMock.findOne.mockResolvedValue(request);

      const result = await service.findOne(requestId, admin);
      expect(result).toEqual(request);
    });

    it('should allow Client to view their OWN request', async () => {
      const request = { id: requestId, clientId: 'client-a' } as ProjectRequestEntity;
      repositoryMock.findOne.mockResolvedValue(request);

      const result = await service.findOne(requestId, clientA);
      expect(result).toEqual(request);
    });

    it('should MASK data when Broker views PENDING request (Unassigned)', async () => {
        const request = { 
            id: requestId, 
            status: RequestStatus.PENDING, 
            clientId: 'client-a',
            client: { email: 'secret@email.com', phoneNumber: '099999999' }
        } as ProjectRequestEntity;
        
        // Clone to simulate db return distinct object
        repositoryMock.findOne.mockResolvedValue({ ...request, client: { ...request.client } });
  
        const result = await service.findOne(requestId, brokerMe);
        
        expect(result.client.email).toBe('********');
        expect(result.client.phoneNumber).toBe('********');
    });

    it('should NOT allow Client A to view Client B request', async () => {
      const request = { id: requestId, clientId: 'client-b' } as ProjectRequestEntity;
      repositoryMock.findOne.mockResolvedValue(request);

      await expect(service.findOne(requestId, clientA)).rejects.toThrow(ForbiddenException);
    });

    it('should allow Broker to view ASSIGNED request (Processing)', async () => {
       const request = { 
         id: requestId, 
         status: RequestStatus.PROCESSING, 
         brokerId: 'broker-me',
         client: { email: 'show@email.com' } 
       } as ProjectRequestEntity;
       repositoryMock.findOne.mockResolvedValue(request);
 
       const result = await service.findOne(requestId, brokerMe);
       expect(result).toEqual(request);
       expect(result.client.email).toBe('show@email.com'); // Not masked
    });

    it('should NOT allow Broker to view request assigned to SOMEONE ELSE', async () => {
        const request = { 
          id: requestId, 
          status: RequestStatus.PROCESSING, 
          brokerId: 'broker-other' 
        } as ProjectRequestEntity;
        repositoryMock.findOne.mockResolvedValue(request);
  
        await expect(service.findOne(requestId, brokerMe)).rejects.toThrow(ForbiddenException);
     });
  });
});
