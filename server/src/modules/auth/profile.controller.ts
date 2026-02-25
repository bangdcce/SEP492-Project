import {
  Controller,
  Post,
  Get,
  Delete,
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
import { UserSkillEntity, SkillPriority, SkillVerificationStatus } from '../../database/entities/user-skill.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import * as path from 'path';

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
  ) {}

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
    @UploadedFile() file: Express.Multer.File,
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
      const ext = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.docx');
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
      const { data: urlData } = supabaseClient.storage
        .from('cvs')
        .getPublicUrl(storagePath);

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
      const { error } = await supabaseClient.storage
        .from('cvs')
        .remove([storagePath]);

      if (error) {
        console.error('[CV Delete Error]:', error);
        // Don't throw - still clear DB reference
      }

      // Clear CV URL in profile
      await this.profileRepo.update(
        { userId },
        { cvUrl: '' },
      );

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
      skills: userSkills.map(us => ({
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

    // Validate all skill IDs exist
    const skills = await this.skillRepo.find({
      where: { id: In(skillIds) },
    });

    if (skills.length !== skillIds.length) {
      throw new BadRequestException('One or more invalid skill IDs');
    }

    // Get current skills
    const currentSkills = await this.userSkillRepo.find({
      where: { userId },
    });

    const currentSkillIds = currentSkills.map(us => us.skillId);

    // Determine skills to add and remove
    const skillsToAdd = skillIds.filter(id => !currentSkillIds.includes(id));
    const skillsToRemove = currentSkillIds.filter(id => !skillIds.includes(id));

    // Remove old skills
    if (skillsToRemove.length > 0) {
      await this.userSkillRepo.delete({
        userId,
        skillId: In(skillsToRemove),
      });
    }

    // Add new skills (all as SECONDARY by default, user can set PRIMARY via other endpoint)
    if (skillsToAdd.length > 0) {
      const newUserSkills = skillsToAdd.map(skillId => {
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
}
