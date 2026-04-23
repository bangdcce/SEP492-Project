import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Req,
  Body,
  Patch,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { supabaseClient } from '../../config/supabase.config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProfileEntity } from '../../database/entities/profile.entity';
import {
  UserSkillEntity,
  SkillPriority,
  SkillVerificationStatus,
} from '../../database/entities/user-skill.entity';
import { UserSkillDomainEntity } from '../../database/entities/user-skill-domain.entity';
import { SkillCategory, SkillEntity } from '../../database/entities/skill.entity';
import { SkillDomainEntity } from '../../database/entities/skill-domain.entity';
import {
  InitializeSigningCredentialDto,
  RotateSigningCredentialDto,
} from './dto/signing-credentials.dto';
import { SigningCredentialsService } from './signing-credentials.service';
import type { MulterFile } from '../../common/types/multer.type';
import * as path from 'path';

const CUSTOM_DOMAIN_PREFIX = '__other_domain__:';
const CUSTOM_SKILL_PREFIX = '__other_skill__:';
const MAX_TOTAL_DOMAINS = 10;
const MAX_CUSTOM_DOMAINS = 10;
const MAX_TOTAL_SKILLS = 20;
const MAX_CUSTOM_SKILLS = 10;

interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@ApiTags('Profile Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profile')
export class ProfileController {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,
    @InjectRepository(UserSkillEntity)
    private readonly userSkillRepo: Repository<UserSkillEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepo: Repository<SkillEntity>,
    @InjectRepository(UserSkillDomainEntity)
    private readonly userSkillDomainRepo: Repository<UserSkillDomainEntity>,
    @InjectRepository(SkillDomainEntity)
    private readonly skillDomainRepo: Repository<SkillDomainEntity>,
    private readonly signingCredentialsService: SigningCredentialsService,
  ) {}

  @Get('signing-credentials/status')
  @ApiOperation({ summary: 'Get Mini CA signing credential status' })
  async getSigningCredentialStatus(@Req() req: AuthRequest) {
    return this.signingCredentialsService.getCredentialStatus(req.user.id);
  }

  @Post('signing-credentials/initialize')
  @ApiOperation({ summary: 'Initialize Mini CA signing credential for current user' })
  async initializeSigningCredential(
    @Req() req: AuthRequest,
    @Body() dto: InitializeSigningCredentialDto,
  ) {
    return this.signingCredentialsService.initializeCredential(
      req.user.id,
      dto.pin,
      dto.modulusLength,
    );
  }

  @Post('signing-credentials/rotate')
  @ApiOperation({ summary: 'Rotate Mini CA signing keypair using current PIN' })
  async rotateSigningCredential(@Req() req: AuthRequest, @Body() dto: RotateSigningCredentialDto) {
    return this.signingCredentialsService.rotateCredential(
      req.user.id,
      dto.oldPin,
      dto.newPin,
      dto.modulusLength,
    );
  }

  // ==============================================
  // CV MANAGEMENT
  // ==============================================

  @Post('cv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CV (PDF or DOCX, max 5MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadCV(
    @UploadedFile() file: MulterFile,
    @Req() req: AuthRequest,
  ): Promise<{ cvUrl: string; message: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = req.user.id;

    // Validate file type (PDF or DOCX)
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const ext =
        path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.docx');
      const filename = `cv-${timestamp}${ext}`;
      const storagePath = `cvs/${userId}/${filename}`;

      // Upload to Supabase Storage (cvs bucket)
      const { data, error } = await supabaseClient.storage
        .from('cvs')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('[CV Upload Error]:', error);
        throw new BadRequestException(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseClient.storage.from('cvs').getPublicUrl(storagePath);

      const cvUrl = urlData.publicUrl;

      // Upsert profile with CV URL (create if not exists, update if exists)
      let profile = await this.profileRepo.findOne({ where: { userId } });

      if (!profile) {
        // Create new profile if doesn't exist
        profile = this.profileRepo.create({ userId, cvUrl });
        await this.profileRepo.save(profile);
      } else {
        // Update existing profile
        await this.profileRepo.update({ userId }, { cvUrl });
      }

      return {
        cvUrl,
        message: 'CV uploaded successfully',
      };
    } catch (error) {
      console.error('[CV Upload Error]:', error);
      throw new BadRequestException('Failed to upload CV');
    }
  }

  @Get('cv')
  @ApiOperation({ summary: 'Get CV URL (signed URL for download)' })
  async getCV(@Req() req: AuthRequest): Promise<{ cvUrl: string | null }> {
    const userId = req.user.id;

    const profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile || !profile.cvUrl) {
      return { cvUrl: null };
    }

    // If it's a public URL, return as is
    // If it's a storage path, generate signed URL
    let cvUrl = profile.cvUrl;
    if (profile.cvUrl.startsWith('cvs/')) {
      const { data, error } = await supabaseClient.storage
        .from('cvs')
        .createSignedUrl(profile.cvUrl, 3600); // 1 hour expiry

      if (error) {
        throw new NotFoundException('CV file not found in storage');
      }
      cvUrl = data.signedUrl;
    }

    return { cvUrl };
  }

  @Delete('cv')
  @ApiOperation({ summary: 'Delete CV' })
  async deleteCV(@Req() req: AuthRequest): Promise<{ message: string }> {
    const userId = req.user.id;

    const profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile || !profile.cvUrl) {
      throw new NotFoundException('No CV found');
    }

    try {
      // Extract storage path from URL
      let storagePath = profile.cvUrl;
      if (profile.cvUrl.startsWith('cvs/')) {
        // Already a storage path
        storagePath = profile.cvUrl;
      } else if (profile.cvUrl.includes('cvs/')) {
        // Extract path from public URL
        const match = profile.cvUrl.match(/cvs\/.+$/);
        if (match) storagePath = match[0];
      }

      // Delete from Supabase Storage
      const { error } = await supabaseClient.storage.from('cvs').remove([storagePath]);

      if (error) {
        console.error('[CV Delete Error]:', error);
        // Don't throw - still clear DB reference
      }

      // Clear CV URL in profile
      await this.profileRepo.update({ userId }, { cvUrl: '' });

      return { message: 'CV deleted successfully' };
    } catch (error) {
      console.error('[CV Delete Error]:', error);
      throw new BadRequestException('Failed to delete CV');
    }
  }

  // ==============================================
  // BIO MANAGEMENT
  // ==============================================

  @Patch('bio')
  @ApiOperation({ summary: 'Update bio' })
  async updateBio(
    @Req() req: AuthRequest,
    @Body() body: { bio: string },
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    const { bio } = body;

    if (!bio || bio.trim().length === 0) {
      throw new BadRequestException('Bio cannot be empty');
    }

    if (bio.length > 1000) {
      throw new BadRequestException('Bio must not exceed 1000 characters');
    }

    // Upsert profile (create if not exists)
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepo.create({ userId, bio: bio.trim() });
      await this.profileRepo.save(profile);
    } else {
      await this.profileRepo.update({ userId }, { bio: bio.trim() });
    }

    return { message: 'Bio updated successfully' };
  }

  // ==============================================
  // DOMAINS MANAGEMENT
  // ==============================================

  @Get('domains')
  @ApiOperation({ summary: 'Get my domains with full details' })
  async getMyDomains(@Req() req: AuthRequest) {
    const userId = req.user.id;

    const userDomains = await this.userSkillDomainRepo.find({
      where: { userId },
      relations: ['domain'],
      order: { createdAt: 'DESC' },
    });

    return {
      domains: userDomains
        .filter((ud) => !!ud.domain)
        .map((ud) => ({
          id: ud.id,
          domainId: ud.domainId,
          domainName: ud.domain.name,
          domainSlug: ud.domain.slug,
          domainDescription: ud.domain.description,
          domainIcon: ud.domain.icon,
          createdAt: ud.createdAt,
        })),
    };
  }

  @Put('domains')
  @ApiOperation({ summary: 'Update user domains (replace all)' })
  async updateDomains(
    @Req() req: AuthRequest,
    @Body() body: { domainIds: string[] },
  ): Promise<{ message: string; addedCount: number; removedCount: number }> {
    const userId = req.user.id;
    const { domainIds } = body;

    if (!domainIds || !Array.isArray(domainIds)) {
      throw new BadRequestException('domainIds must be an array');
    }

    const { ids: rawDomainIds, custom: customDomains } = this.parseTaggedSelections(
      domainIds,
      CUSTOM_DOMAIN_PREFIX,
    );

    const selectedDomainIds = new Set(rawDomainIds);
    const normalizedCustomDomains = this.normalizeCustomEntries(customDomains);

    if (normalizedCustomDomains.length > MAX_CUSTOM_DOMAINS) {
      throw new BadRequestException(`You can add up to ${MAX_CUSTOM_DOMAINS} custom domains`);
    }

    for (const domainName of normalizedCustomDomains) {
      let domain = await this.skillDomainRepo
        .createQueryBuilder('domain')
        .where('LOWER(domain.name) = LOWER(:name)', { name: domainName })
        .getOne();

      if (!domain) {
        domain = await this.skillDomainRepo.save(
          this.skillDomainRepo.create({
            name: domainName,
            slug: this.toSafeSlug(domainName, 'custom-domain'),
            description: 'User-added from profile domains',
            isActive: true,
            sortOrder: 9999,
          }),
        );
      }

      selectedDomainIds.add(domain.id);
    }

    const nextDomainIds = [...selectedDomainIds];

    if (nextDomainIds.length === 0) {
      throw new BadRequestException('At least one domain is required');
    }

    if (nextDomainIds.length > MAX_TOTAL_DOMAINS) {
      throw new BadRequestException(`You can select up to ${MAX_TOTAL_DOMAINS} domains in total`);
    }

    const domains = await this.skillDomainRepo.find({
      where: { id: In(nextDomainIds) },
    });

    if (domains.length !== nextDomainIds.length) {
      throw new BadRequestException('One or more invalid domain IDs');
    }

    const currentDomains = await this.userSkillDomainRepo.find({
      where: { userId },
    });

    const currentDomainIds = currentDomains.map((ud) => ud.domainId);

    const domainsToAdd = nextDomainIds.filter((id) => !currentDomainIds.includes(id));
    const domainsToRemove = currentDomainIds.filter((id) => !nextDomainIds.includes(id));

    if (domainsToRemove.length > 0) {
      await this.userSkillDomainRepo.delete({
        userId,
        domainId: In(domainsToRemove),
      });
    }

    if (domainsToAdd.length > 0) {
      const newUserDomains = domainsToAdd.map((domainId) => {
        const userDomain = new UserSkillDomainEntity();
        userDomain.userId = userId;
        userDomain.domainId = domainId;
        return userDomain;
      });

      await this.userSkillDomainRepo.save(newUserDomains);
    }

    return {
      message: 'Domains updated successfully',
      addedCount: domainsToAdd.length,
      removedCount: domainsToRemove.length,
    };
  }

  @Delete('domains/:domainId/custom')
  @ApiOperation({ summary: 'Delete a custom domain created by the current user' })
  async deleteCustomDomain(
    @Req() req: AuthRequest,
    @Param('domainId') domainId: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;

    const domain = await this.skillDomainRepo.findOne({ where: { id: domainId } });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    if (!(domain.description || '').toLowerCase().startsWith('user-added')) {
      throw new BadRequestException('Only custom domains can be deleted');
    }

    await this.userSkillDomainRepo.delete({ userId, domainId });

    const remainingReferences = await this.userSkillDomainRepo.count({
      where: { domainId },
    });

    if (remainingReferences === 0) {
      await this.skillDomainRepo.delete({ id: domainId });
    }

    return { message: 'Custom domain deleted successfully' };
  }

  private normalizeCustomEntries(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    const unique = new Map<string, string>();
    for (const rawValue of values) {
      const trimmed = String(rawValue || '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!trimmed) {
        continue;
      }

      const normalizedKey = trimmed.toLowerCase();
      if (!unique.has(normalizedKey)) {
        unique.set(normalizedKey, trimmed.slice(0, 100));
      }
    }

    return [...unique.values()];
  }

  private parseTaggedSelections(values: string[] | undefined, prefix: string): {
    ids: string[];
    custom: string[];
  } {
    if (!values || values.length === 0) {
      return { ids: [], custom: [] };
    }

    const ids: string[] = [];
    const custom: string[] = [];

    for (const rawValue of values) {
      const value = String(rawValue || '').trim();
      if (!value) {
        continue;
      }

      if (value.startsWith(prefix)) {
        const label = value.slice(prefix.length).trim();
        if (label) {
          custom.push(label);
        }
        continue;
      }

      ids.push(value);
    }

    return { ids, custom };
  }

  private toSafeSlug(value: string, fallbackPrefix: string): string {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const suffix = Math.random().toString(36).slice(2, 10);
    return `${normalized || fallbackPrefix}-${suffix}`;
  }

  // ==============================================
  // SKILLS MANAGEMENT
  // ==============================================

  @Get('skills')
  @ApiOperation({ summary: 'Get my skills with full details' })
  async getMySkills(@Req() req: AuthRequest) {
    const userId = req.user.id;

    const userSkills = await this.userSkillRepo.find({
      where: { userId },
      relations: ['skill'],
      order: { priority: 'ASC', createdAt: 'DESC' },
    });

    return {
      skills: userSkills.map((us) => ({
        id: us.id,
        skillId: us.skillId,
        skillName: us.skill.name,
        skillSlug: us.skill.slug,
        skillCategory: us.skill.category,
        priority: us.priority,
        verificationStatus: us.verificationStatus,
        proficiencyLevel: us.proficiencyLevel,
        yearsOfExperience: us.yearsOfExperience,
        portfolioUrl: us.portfolioUrl,
        completedProjectsCount: us.completedProjectsCount,
        lastUsedAt: us.lastUsedAt,
      })),
    };
  }

  @Put('skills')
  @ApiOperation({ summary: 'Update user skills (replace all)' })
  async updateSkills(
    @Req() req: AuthRequest,
    @Body() body: { skillIds: string[] },
  ): Promise<{ message: string; addedCount: number; removedCount: number }> {
    const userId = req.user.id;
    const { skillIds } = body;

    if (!skillIds || !Array.isArray(skillIds)) {
      throw new BadRequestException('skillIds must be an array');
    }

    if (skillIds.length === 0) {
      throw new BadRequestException('At least one skill is required');
    }

    const { ids: rawSkillIds, custom: customSkills } = this.parseTaggedSelections(
      skillIds,
      CUSTOM_SKILL_PREFIX,
    );

    const normalizedCustomSkills = this.normalizeCustomEntries(customSkills);

    if (normalizedCustomSkills.length > MAX_CUSTOM_SKILLS) {
      throw new BadRequestException(`You can add up to ${MAX_CUSTOM_SKILLS} custom skills`);
    }

    const selectedSkillIds = new Set(rawSkillIds);

    for (const skillName of normalizedCustomSkills) {
      let skill = await this.skillRepo
        .createQueryBuilder('skill')
        .where('LOWER(skill.name) = LOWER(:name)', { name: skillName })
        .getOne();

      if (!skill) {
        skill = await this.skillRepo.save(
          this.skillRepo.create({
            domainId: null,
            name: skillName,
            slug: this.toSafeSlug(skillName, 'custom-skill'),
            description: 'User-added from profile skills',
            category: SkillCategory.OTHER,
            isActive: true,
            sortOrder: 9999,
            forFreelancer: req.user.role === 'FREELANCER',
            forBroker: req.user.role === 'BROKER',
            forStaff: req.user.role === 'STAFF',
          }),
        );
      }

      selectedSkillIds.add(skill.id);
    }

    const nextSkillIds = [...selectedSkillIds];

    if (nextSkillIds.length === 0) {
      throw new BadRequestException('At least one skill is required');
    }

    if (nextSkillIds.length > MAX_TOTAL_SKILLS) {
      throw new BadRequestException(`You can select up to ${MAX_TOTAL_SKILLS} skills in total`);
    }

    // Validate all skill IDs exist
    const skills = await this.skillRepo.find({
      where: { id: In(nextSkillIds) },
    });

    if (skills.length !== nextSkillIds.length) {
      throw new BadRequestException('One or more invalid skill IDs');
    }

    // Get current skills
    const currentSkills = await this.userSkillRepo.find({
      where: { userId },
    });

    const currentSkillIds = currentSkills.map((us) => us.skillId);

    // Determine skills to add and remove
    const skillsToAdd = nextSkillIds.filter((id) => !currentSkillIds.includes(id));
    const skillsToRemove = currentSkillIds.filter((id) => !nextSkillIds.includes(id));

    // Remove old skills
    if (skillsToRemove.length > 0) {
      await this.userSkillRepo.delete({
        userId,
        skillId: In(skillsToRemove),
      });
    }

    // Add new skills (all as SECONDARY by default, user can set PRIMARY via other endpoint)
    if (skillsToAdd.length > 0) {
      const newUserSkills = skillsToAdd.map((skillId) => {
        const userSkill = new UserSkillEntity();
        userSkill.userId = userId;
        userSkill.skillId = skillId;
        userSkill.priority = SkillPriority.SECONDARY;
        userSkill.verificationStatus = SkillVerificationStatus.SELF_DECLARED;
        userSkill.proficiencyLevel = null;
        userSkill.yearsOfExperience = null;
        userSkill.portfolioUrl = null;
        userSkill.completedProjectsCount = 0;
        userSkill.lastUsedAt = null;
        return userSkill;
      });

      await this.userSkillRepo.save(newUserSkills);
    }

    return {
      message: 'Skills updated successfully',
      addedCount: skillsToAdd.length,
      removedCount: skillsToRemove.length,
    };
  }

  @Delete('skills/:skillId/custom')
  @ApiOperation({ summary: 'Delete a custom skill created by the current user' })
  async deleteCustomSkill(
    @Req() req: AuthRequest,
    @Param('skillId') skillId: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;

    const skill = await this.skillRepo.findOne({ where: { id: skillId } });
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    if (!(skill.description || '').toLowerCase().startsWith('user-added')) {
      throw new BadRequestException('Only custom skills can be deleted');
    }

    await this.userSkillRepo.delete({ userId, skillId });

    const remainingReferences = await this.userSkillRepo.count({
      where: { skillId },
    });

    if (remainingReferences === 0) {
      await this.skillRepo.delete({ id: skillId });
    }

    return { message: 'Custom skill deleted successfully' };
  }
}
