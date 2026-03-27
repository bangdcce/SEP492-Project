import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedingController } from './seeding.controller';
import { SeedingService } from './seeding.service';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectSpecEntity } from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProjectRequestEntity,
      ProjectSpecEntity,
      MilestoneEntity,
      SkillEntity,
      UserSkillEntity,
    ]),
  ],
  controllers: [SeedingController],
  providers: [SeedingService],
})
export class SeedingModule {}
