import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  PayoutMethodEntity,
  PayoutMethodType,
  PayoutRequestEntity,
} from '../../database/entities';
import { CreatePayoutMethodDto } from './dto';
import { PayoutMethodView } from './payments.types';

@Injectable()
export class PayoutMethodsService {
  constructor(
    @InjectRepository(PayoutMethodEntity)
    private readonly payoutMethodRepository: Repository<PayoutMethodEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listForUser(userId: string): Promise<PayoutMethodView[]> {
    const methods = await this.payoutMethodRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    const requestHistory = await this.buildRequestHistoryMap(methods.map((method) => method.id));

    return methods.map((method) => this.toPayoutMethodView(method, !requestHistory.has(method.id)));
  }

  async createForUser(userId: string, dto: CreatePayoutMethodDto): Promise<PayoutMethodView> {
    this.assertMethodPayload(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutMethodEntity);
      const existingCount = await repo.count({ where: { userId } });
      const shouldBecomeDefault = dto.isDefault ?? existingCount === 0;

      if (shouldBecomeDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      const method = repo.create({
        userId,
        type: dto.type,
        displayName: this.buildDisplayName(dto),
        paypalEmail: dto.type === PayoutMethodType.PAYPAL_EMAIL ? dto.paypalEmail!.trim() : null,
        bankName: dto.type === PayoutMethodType.BANK_ACCOUNT ? dto.bankName!.trim() : null,
        bankCode: dto.bankCode?.trim() || null,
        accountNumber:
          dto.type === PayoutMethodType.BANK_ACCOUNT ? dto.accountNumber!.trim() : null,
        accountHolderName:
          dto.type === PayoutMethodType.BANK_ACCOUNT ? dto.accountHolderName!.trim() : null,
        branchName: dto.branchName?.trim() || null,
        isDefault: shouldBecomeDefault,
        isVerified: false,
      });

      const saved = await repo.save(method);
      return this.toPayoutMethodView(saved, true);
    });
  }

  async updateForUser(
    userId: string,
    payoutMethodId: string,
    dto: CreatePayoutMethodDto,
  ): Promise<PayoutMethodView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutMethodEntity);
      const method = await repo.findOne({
        where: { id: payoutMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payout method ${payoutMethodId} not found`);
      }

      if (dto.type !== method.type) {
        throw new BadRequestException('Changing payout method type is not supported');
      }

      const normalizedDto = this.buildUpdatePayload(method, dto);
      this.assertMethodPayload(normalizedDto);

      const shouldBecomeDefault = method.isDefault ? true : Boolean(dto.isDefault);
      if (shouldBecomeDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      method.displayName = this.buildDisplayName(normalizedDto);
      method.paypalEmail =
        normalizedDto.type === PayoutMethodType.PAYPAL_EMAIL
          ? normalizedDto.paypalEmail!.trim()
          : null;
      method.bankName =
        normalizedDto.type === PayoutMethodType.BANK_ACCOUNT
          ? normalizedDto.bankName!.trim()
          : null;
      method.bankCode = normalizedDto.bankCode?.trim() || null;
      method.accountNumber =
        normalizedDto.type === PayoutMethodType.BANK_ACCOUNT
          ? normalizedDto.accountNumber!.trim()
          : null;
      method.accountHolderName =
        normalizedDto.type === PayoutMethodType.BANK_ACCOUNT
          ? normalizedDto.accountHolderName!.trim()
          : null;
      method.branchName = normalizedDto.branchName?.trim() || null;
      method.isDefault = shouldBecomeDefault;

      const saved = await repo.save(method);
      return this.toPayoutMethodView(saved, !(await this.hasRequestHistory(manager, saved.id)));
    });
  }

  async setDefault(userId: string, payoutMethodId: string): Promise<PayoutMethodView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutMethodEntity);
      const method = await repo.findOne({
        where: { id: payoutMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payout method ${payoutMethodId} not found`);
      }

      await repo.update({ userId, isDefault: true }, { isDefault: false });
      method.isDefault = true;
      const saved = await repo.save(method);
      return this.toPayoutMethodView(saved, !(await this.hasRequestHistory(manager, saved.id)));
    });
  }

  async deleteForUser(
    userId: string,
    payoutMethodId: string,
  ): Promise<{ deletedId: string; nextDefaultMethodId: string | null }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutMethodEntity);
      const method = await repo.findOne({
        where: { id: payoutMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payout method ${payoutMethodId} not found`);
      }

      const requestHistoryCount = await manager.getRepository(PayoutRequestEntity).count({
        where: { payoutMethodId },
      });

      if (requestHistoryCount > 0) {
        throw new ConflictException('This payout method has request history and cannot be deleted.');
      }

      await repo.delete({ id: payoutMethodId, userId });

      let nextDefaultMethodId: string | null = null;
      if (method.isDefault) {
        const remainingMethods = await repo.find({
          where: { userId },
          order: { createdAt: 'ASC' },
        });
        const replacement = remainingMethods.find((candidate) =>
          this.belongsToSameLane(candidate.type, method.type),
        );

        if (replacement) {
          replacement.isDefault = true;
          const savedReplacement = await repo.save(replacement);
          nextDefaultMethodId = savedReplacement.id;
        }
      }

      return {
        deletedId: payoutMethodId,
        nextDefaultMethodId,
      };
    });
  }

  toPayoutMethodView(method: PayoutMethodEntity, canDelete = true): PayoutMethodView {
    return {
      id: method.id,
      type: method.type,
      displayName: method.displayName,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      canDelete,
      paypalEmail: method.paypalEmail,
      bankName: method.bankName,
      bankCode: method.bankCode,
      branchName: method.branchName,
      accountNumberMasked: this.maskAccountNumber(method.accountNumber),
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private buildUpdatePayload(
    method: PayoutMethodEntity,
    dto: CreatePayoutMethodDto,
  ): CreatePayoutMethodDto {
    if (method.type === PayoutMethodType.PAYPAL_EMAIL) {
      return {
        type: method.type,
        displayName: dto.displayName ?? method.displayName,
        paypalEmail: dto.paypalEmail?.trim() || method.paypalEmail || undefined,
        isDefault: dto.isDefault ?? method.isDefault,
      };
    }

    return {
      type: method.type,
      displayName: dto.displayName ?? method.displayName,
      bankName: dto.bankName?.trim() || method.bankName || undefined,
      bankCode: dto.bankCode?.trim() || method.bankCode || undefined,
      accountNumber: dto.accountNumber?.trim() || method.accountNumber || undefined,
      accountHolderName:
        dto.accountHolderName?.trim() || method.accountHolderName || undefined,
      branchName: dto.branchName?.trim() || method.branchName || undefined,
      isDefault: dto.isDefault ?? method.isDefault,
    };
  }

  private assertMethodPayload(dto: CreatePayoutMethodDto): void {
    if (dto.type === PayoutMethodType.PAYPAL_EMAIL) {
      if (!dto.paypalEmail?.trim()) {
        throw new BadRequestException('paypalEmail is required for PAYPAL_EMAIL');
      }
      return;
    }

    if (!dto.bankName?.trim()) {
      throw new BadRequestException('bankName is required for BANK_ACCOUNT');
    }
    if (!dto.accountNumber?.trim()) {
      throw new BadRequestException('accountNumber is required for BANK_ACCOUNT');
    }
    if (!dto.accountHolderName?.trim()) {
      throw new BadRequestException('accountHolderName is required for BANK_ACCOUNT');
    }
  }

  private buildDisplayName(dto: CreatePayoutMethodDto): string {
    const explicit = dto.displayName?.trim();
    if (explicit) {
      return explicit;
    }

    if (dto.type === PayoutMethodType.PAYPAL_EMAIL) {
      return dto.paypalEmail!.trim();
    }

    const bankName = dto.bankName!.trim();
    const masked = this.maskAccountNumber(dto.accountNumber?.trim() || null) ?? 'account';
    return `${bankName} ${masked}`.trim();
  }

  private belongsToSameLane(
    candidateType: PayoutMethodType,
    deletedType: PayoutMethodType,
  ): boolean {
    return candidateType === deletedType;
  }

  private maskAccountNumber(accountNumber: string | null): string | null {
    if (!accountNumber) {
      return null;
    }

    const trimmed = accountNumber.trim();
    if (trimmed.length <= 4) {
      return trimmed;
    }

    return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
  }

  private async hasRequestHistory(
    manager: EntityManager,
    payoutMethodId: string,
  ): Promise<boolean> {
    return manager.getRepository(PayoutRequestEntity).exist({ where: { payoutMethodId } });
  }

  private async buildRequestHistoryMap(
    payoutMethodIds: string[],
  ): Promise<Map<string, number>> {
    if (payoutMethodIds.length === 0) {
      return new Map();
    }

    const rows = await this.dataSource.getRepository(PayoutRequestEntity)
      .createQueryBuilder('request')
      .select('request.payoutMethodId', 'payoutMethodId')
      .addSelect('COUNT(*)', 'count')
      .where('request.payoutMethodId IN (:...payoutMethodIds)', { payoutMethodIds })
      .groupBy('request.payoutMethodId')
      .getRawMany<{ payoutMethodId: string; count: string }>();

    return new Map(rows.map((row) => [row.payoutMethodId, Number(row.count)]));
  }
}
