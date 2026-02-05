import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from '../../database/entities/user.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';
import { UsersSearchController } from './users.search.controller';
import { UsersSearchService } from './users.search.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    UserEntity,
    ProfileEntity,
    UserSkillEntity,
  ])],
  controllers: [UsersController, UsersSearchController],
  providers: [UsersService, UsersSearchService],
  exports: [UsersService, UsersSearchService],
})
export class UsersModule {}
