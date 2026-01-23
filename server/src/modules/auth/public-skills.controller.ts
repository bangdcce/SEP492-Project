import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillDomainEntity } from '../../database/entities/skill-domain.entity';
import { SkillEntity } from '../../database/entities/skill.entity';

@ApiTags('Public - Skills & Domains')
@Controller('public/skills')
export class PublicSkillsController {
  constructor(
    @InjectRepository(SkillDomainEntity)
    private domainRepo: Repository<SkillDomainEntity>,
    @InjectRepository(SkillEntity)
    private skillRepo: Repository<SkillEntity>,
  ) {}

  @Get('domains')
  @ApiOperation({ summary: 'Get list of skill domains for registration' })
  async getDomains() {
    const domains = await this.domainRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon'],
    });

    return {
      success: true,
      data: domains,
    };
  }

  @Get('skills')
  @ApiOperation({ summary: 'Get list of skills for registration' })
  @ApiQuery({ name: 'role', required: false, enum: ['FREELANCER', 'BROKER'] })
  async getSkills(@Query('role') role?: string) {
    const where: any = { isActive: true };

    // Filter by role
    if (role === 'FREELANCER') {
      where.forFreelancer = true;
    } else if (role === 'BROKER') {
      where.forBroker = true;
    }

    const skills = await this.skillRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon', 'category'],
    });

    return {
      success: true,
      data: skills,
    };
  }
}
