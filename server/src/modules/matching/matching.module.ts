import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';

// Entities needed
import { UserEntity } from '../../database/entities/user.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectSpecEntity } from '../../database/entities/project-spec.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';

// Services
import { HardFilterService } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { LlmClientService } from './llm-client.service';
import { AiRankerService } from './ai-ranker.service';
import { ClassifierService } from './classifier.service';
import { MatchingService } from './matching.service';

// Controller
import { MatchingController } from './matching.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      UserSkillEntity,
      SkillEntity,
      ProjectEntity,
      ProjectRequestEntity,
      ProjectSpecEntity,
      ProjectRequestProposalEntity,
    ]),
    CacheModule.register({
      ttl: 3600000, // 1 hour memory cache default
    }),
  ],
  controllers: [MatchingController],
  providers: [
    HardFilterService,
    TagScorerService,
    LlmClientService,
    AiRankerService,
    ClassifierService,
    MatchingService,
  ],
  exports: [MatchingService],
})
export class MatchingModule {}
