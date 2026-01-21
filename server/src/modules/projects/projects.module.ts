import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, DisputeEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
