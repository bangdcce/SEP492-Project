import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserEntity } from '../../database/entities/user.entity';
import { HardFilterService } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { LlmClientService } from './llm-client.service';
import { AiRankerService } from './ai-ranker.service';
import { ClassifierService } from './classifier.service';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProjectRequestEntity,
      BrokerProposalEntity,
    ]),
    ConfigModule,
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
