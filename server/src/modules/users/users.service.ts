import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { BanUserDto, UnbanUserDto, ResetUserPasswordDto, UserFilterDto } from './dto/admin-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Get all users with filters (Admin only)
   */
  async getAllUsers(filters: UserFilterDto) {
    const { role, search, isBanned, page = 1, limit = 20 } = filters;

    const queryBuilder = this.userRepo.createQueryBuilder('user');

    // Filter by role
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    // Search by email or fullName
    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by ban status
    if (isBanned !== undefined) {
      queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned });
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by newest first
    queryBuilder.orderBy('user.createdAt', 'DESC');

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user detail by ID (Admin only)
   */
  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Ban user (Admin only)
   */
  async banUser(userId: string, adminId: string, dto: BanUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    // Update user status
    user.isBanned = true;
    user.banReason = dto.reason;
    user.bannedAt = new Date();
    user.bannedBy = adminId;

    await this.userRepo.save(user);

    // TODO: Log audit log
    console.log(`✅ User ${user.email} banned by admin ${adminId}`);

    return {
      message: 'User banned successfully',
      user,
    };
  }

  /**
   * Unban user (Admin only)
   */
  async unbanUser(userId: string, adminId: string, dto: UnbanUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    // Update user status
    user.isBanned = false;
    user.banReason = null;
    user.bannedAt = null;
    user.bannedBy = null;

    await this.userRepo.save(user);

    // TODO: Log audit log
    console.log(`✅ User ${user.email} unbanned by admin ${adminId}. Reason: ${dto.reason}`);

    return {
      message: 'User unbanned successfully',
      user,
    };
  }

  /**
   * Reset user password (Admin only)
   */
  async resetUserPassword(userId: string, adminId: string, dto: ResetUserPasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    user.passwordHash = hashedPassword;
    await this.userRepo.save(user);

    // TODO: Send email notification if sendEmail = true
    if (dto.sendEmail) {
      console.log(`📧 Email sent to ${user.email} with new temporary password`);
    }

    // TODO: Log audit log
    console.log(`✅ Password reset for user ${user.email} by admin ${adminId}`);

    return {
      message: 'Password reset successfully',
      email: user.email,
    };
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStatistics() {
    const total = await this.userRepo.count();
    const banned = await this.userRepo.count({ where: { isBanned: true } });
    const verified = await this.userRepo.count({ where: { isVerified: true } });

    const byRole = await this.userRepo
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return {
      total,
      banned,
      verified,
      byRole: byRole.reduce((acc, item) => {
        acc[item.role] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }
}
