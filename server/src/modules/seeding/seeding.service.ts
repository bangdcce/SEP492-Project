import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { ProjectRequestEntity, RequestStatus } from '../../database/entities/project-request.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedingService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepository: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectSpecEntity)
    private readonly specRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
  ) {}

  async seedC05() {
    try {
      console.log('Start seeding C05...');
      // 1. Ensure Users Exist
      const broker = await this.ensureUser('broker@test.com', 'Broker Test', UserRole.BROKER);
      const client = await this.ensureUser('client@test.com', 'Client Test', UserRole.CLIENT);

      // 2. Create Pending Request
      const pendingTitle = 'E-commerce Website Redesign';
      const existingPending = await this.requestRepository.findOne({ where: { title: pendingTitle } });
      if (!existingPending) {
        await this.createRequest(
          client.id,
          pendingTitle,
          'Need a modern redesign for our shopify store.',
          '50-100M VND',
          RequestStatus.PENDING
        );
      }

      // 3. Create Processing Request
      const processingTitle = 'Mobile App for Food Delivery';
      const existingProcessing = await this.requestRepository.findOne({ where: { title: processingTitle } });
      if (!existingProcessing) {
        await this.createRequest(
          client.id,
          processingTitle,
          'UberEats clone for local market.',
          '100-200M VND',
          RequestStatus.PROCESSING,
          broker.id
        );
      }

      // 4. Create Spec Submitted Request
      const specTitle = 'Corporate CRM System';
      let reqWithSpec = await this.requestRepository.findOne({ where: { title: specTitle }, relations: ['spec'] });
      
      if (!reqWithSpec) {
        reqWithSpec = await this.createRequest(
          client.id,
          specTitle,
          'Internal CRM for managing sales leads.',
          '200M+ VND',
          RequestStatus.SPEC_SUBMITTED,
          broker.id
        );
      }

      if (!reqWithSpec.spec) {
        console.log('Creating spec for request:', reqWithSpec.id);
        const spec = this.specRepository.create({
          requestId: reqWithSpec.id,
          title: 'CRM Specification v1',
          description: 'Detailed spec for CRM...',
          totalBudget: 150000000,
          status: ProjectSpecStatus.PENDING_APPROVAL,
        });
        
        // Save spec first
        const savedSpec = await this.specRepository.save(spec);
        
        // Manually link back if needed or let TypeORM handle via requestId
        // In one-to-one, we established relation.
        
        // Create Milestones
        const m1 = this.milestoneRepository.create({
          projectSpecId: savedSpec.id, // Assuming implicit columns or relation
          projectSpec: savedSpec,
          title: 'Phase 1: Database Design',
          description: 'Schema and Tables',
          amount: 50000000,
          status: MilestoneStatus.PENDING,
        });
        const m2 = this.milestoneRepository.create({
          projectSpecId: savedSpec.id,
          projectSpec: savedSpec,
          title: 'Phase 2: API Development',
          description: 'Core Endpoints',
          amount: 100000000,
          status: MilestoneStatus.PENDING,
        });
        await this.milestoneRepository.save([m1, m2]);
        console.log('Spec and milestones created.');
      }

      return { message: 'C05 Seed Data Created Successfully' };
    } catch (error) {
      console.error('Seeding C05 Failed:', error);
      throw error;
    }
  }

  private async ensureUser(email: string, fullName: string, role: UserRole) {
    let user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      user = this.userRepository.create({
        email,
        fullName,
        role,
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: true,
        phoneNumber: '0900000000' + Math.floor(Math.random() * 10),
      });
      await this.userRepository.save(user);
    } else if (!user.passwordHash) {
        // Fix for existing users without password (e.g. from bad seed)
        console.log(`Updating password for ${email}`);
        user.passwordHash = await bcrypt.hash('password123', 10);
        await this.userRepository.save(user);
    }
    return user;
  }

  private async createRequest(clientId: string, title: string, description: string, budget: string, status: RequestStatus, brokerId?: string) {
    const req = this.requestRepository.create({
      clientId,
      title,
      description,
      budgetRange: budget,
      status,
      brokerId,
      intendedTimeline: '3 months',
      techPreferences: 'Node.js, React',
    });
    return await this.requestRepository.save(req);
  }
}
