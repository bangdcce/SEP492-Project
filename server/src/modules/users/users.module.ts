import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from '../../database/entities/user.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';
import { UsersSearchController } from './users.search.controller';
import { UsersSearchService } from './users.search.service';
import { KycVerificationEntity } from '../../database/entities/kyc-verification.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';
import { TrustProfilesController } from './trust-profiles.controller';
import { TrustProfilesService } from './trust-profiles.service';
import { FreelancerDashboardController } from './freelancer-dashboard.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      UserSkillEntity,
      KycVerificationEntity,
      ReviewEntity,
      ProjectEntity,
      ProjectRequestEntity,
      ProjectRequestProposalEntity,
      BrokerProposalEntity,
    ]),
  ],
  controllers: [
    UsersController,
    UsersSearchController,
    TrustProfilesController,
    FreelancerDashboardController,
  ],
  providers: [UsersService, UsersSearchService, TrustProfilesService],
  exports: [UsersService, UsersSearchService, TrustProfilesService],
})
export class UsersModule {}
