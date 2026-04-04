import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  FundingIntentEntity,
  PaymentMethodEntity,
  PaymentMethodType,
} from '../../database/entities';
import { CreatePaymentMethodDto } from './dto';
import { PaymentMethodView } from './payments.types';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethodEntity)
    private readonly paymentMethodRepository: Repository<PaymentMethodEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listForUser(userId: string): Promise<PaymentMethodView[]> {
    const methods = await this.paymentMethodRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });

    const fundingHistoryMap = await this.buildFundingHistoryMap(methods.map((method) => method.id));

    return methods.map((method) =>
      this.toPaymentMethodView(method, !fundingHistoryMap.has(method.id)),
    );
  }

  async createForUser(userId: string, dto: CreatePaymentMethodDto): Promise<PaymentMethodView> {
    this.assertMethodPayload(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentMethodEntity);
      const existingCount = await repo.count({ where: { userId } });
      const shouldBecomeDefault = dto.isDefault ?? existingCount === 0;

      if (shouldBecomeDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      const method = repo.create({
        userId,
        type: dto.type,
        displayName: this.buildDisplayName(dto),
        paypalEmail: dto.type === PaymentMethodType.PAYPAL_ACCOUNT ? dto.paypalEmail!.trim() : null,
        cardBrand: dto.type === PaymentMethodType.CARD_ACCOUNT ? dto.cardBrand!.trim() : null,
        cardLast4: dto.type === PaymentMethodType.CARD_ACCOUNT ? dto.cardLast4!.trim() : null,
        cardholderName:
          dto.type === PaymentMethodType.CARD_ACCOUNT ? dto.cardholderName!.trim() : null,
        cardExpiryMonth:
          dto.type === PaymentMethodType.CARD_ACCOUNT ? dto.cardExpiryMonth! : null,
        cardExpiryYear:
          dto.type === PaymentMethodType.CARD_ACCOUNT ? dto.cardExpiryYear! : null,
        bankName: dto.type === PaymentMethodType.BANK_ACCOUNT ? dto.bankName!.trim() : null,
        bankCode: dto.bankCode?.trim() || null,
        accountNumber:
          dto.type === PaymentMethodType.BANK_ACCOUNT ? dto.accountNumber!.trim() : null,
        accountHolderName:
          dto.type === PaymentMethodType.BANK_ACCOUNT
            ? dto.accountHolderName!.trim()
            : null,
        branchName: dto.branchName?.trim() || null,
        isDefault: shouldBecomeDefault,
        isVerified: false,
      });

      const saved = await repo.save(method);
      return this.toPaymentMethodView(saved, true);
    });
  }

  async setDefault(userId: string, paymentMethodId: string): Promise<PaymentMethodView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentMethodEntity);
      const method = await repo.findOne({
        where: { id: paymentMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
      }

      await repo.update({ userId, isDefault: true }, { isDefault: false });
      method.isDefault = true;
      const saved = await repo.save(method);
      const hasFundingHistory = await manager
        .getRepository(FundingIntentEntity)
        .exist({ where: { paymentMethodId: saved.id } });

      return this.toPaymentMethodView(saved, !hasFundingHistory);
    });
  }

  async updateForUser(
    userId: string,
    paymentMethodId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentMethodEntity);
      const method = await repo.findOne({
        where: { id: paymentMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
      }

      if (dto.type !== method.type) {
        throw new BadRequestException('Changing payment method type is not supported');
      }

      const normalizedDto = this.buildUpdatePayload(method, dto);
      this.assertMethodPayload(normalizedDto);

      const shouldBecomeDefault = method.isDefault ? true : Boolean(dto.isDefault);
      if (shouldBecomeDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      method.displayName = this.buildDisplayName(normalizedDto);
      method.paypalEmail =
        normalizedDto.type === PaymentMethodType.PAYPAL_ACCOUNT
          ? normalizedDto.paypalEmail!.trim()
          : null;
      method.cardBrand =
        normalizedDto.type === PaymentMethodType.CARD_ACCOUNT
          ? normalizedDto.cardBrand!.trim()
          : null;
      method.cardLast4 =
        normalizedDto.type === PaymentMethodType.CARD_ACCOUNT
          ? normalizedDto.cardLast4!.trim()
          : null;
      method.cardholderName =
        normalizedDto.type === PaymentMethodType.CARD_ACCOUNT
          ? normalizedDto.cardholderName!.trim()
          : null;
      method.cardExpiryMonth =
        normalizedDto.type === PaymentMethodType.CARD_ACCOUNT
          ? normalizedDto.cardExpiryMonth!
          : null;
      method.cardExpiryYear =
        normalizedDto.type === PaymentMethodType.CARD_ACCOUNT
          ? normalizedDto.cardExpiryYear!
          : null;
      method.bankName =
        normalizedDto.type === PaymentMethodType.BANK_ACCOUNT
          ? normalizedDto.bankName!.trim()
          : null;
      method.bankCode = normalizedDto.bankCode?.trim() || null;
      method.accountNumber =
        normalizedDto.type === PaymentMethodType.BANK_ACCOUNT
          ? normalizedDto.accountNumber!.trim()
          : null;
      method.accountHolderName =
        normalizedDto.type === PaymentMethodType.BANK_ACCOUNT
          ? normalizedDto.accountHolderName!.trim()
          : null;
      method.branchName = normalizedDto.branchName?.trim() || null;
      method.isDefault = shouldBecomeDefault;

      const saved = await repo.save(method);
      const hasFundingHistory = await manager
        .getRepository(FundingIntentEntity)
        .exist({ where: { paymentMethodId: saved.id } });

      return this.toPaymentMethodView(saved, !hasFundingHistory);
    });
  }

  async resetPayPalCheckoutForUser(
    userId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentMethodEntity);
      const method = await repo.findOne({
        where: { id: paymentMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
      }

      if (method.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
        throw new BadRequestException('Only PAYPAL_ACCOUNT methods can reset PayPal checkout');
      }

      const nextMetadata =
        method.metadata && typeof method.metadata === 'object'
          ? { ...method.metadata }
          : {};
      delete nextMetadata.paypalVault;

      method.paypalEmail = null;
      method.isVerified = false;
      method.verifiedAt = null;
      method.metadata = Object.keys(nextMetadata).length > 0 ? nextMetadata : null;

      if (!method.displayName.trim() || method.displayName.includes('@')) {
        method.displayName = 'PayPal checkout';
      }

      const saved = await repo.save(method);
      const hasFundingHistory = await manager
        .getRepository(FundingIntentEntity)
        .exist({ where: { paymentMethodId: saved.id } });

      return this.toPaymentMethodView(saved, !hasFundingHistory);
    });
  }

  async deleteForUser(
    userId: string,
    paymentMethodId: string,
  ): Promise<{ deletedId: string; nextDefaultMethodId: string | null }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentMethodEntity);
      const method = await repo.findOne({
        where: { id: paymentMethodId, userId },
      });

      if (!method) {
        throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
      }

      const fundingIntentCount = await manager.getRepository(FundingIntentEntity).count({
        where: { paymentMethodId },
      });

      if (fundingIntentCount > 0) {
        throw new ConflictException(
          'This payment method has funding history and cannot be deleted.',
        );
      }

      await repo.delete({ id: paymentMethodId, userId });

      let nextDefaultMethodId: string | null = null;
      if (method.isDefault) {
        const remainingMethods = await repo.find({
          where: { userId },
          order: { createdAt: 'ASC' },
        });
        const replacement = remainingMethods.find((candidate) =>
          this.belongsToSameMethodLane(candidate.type, method.type),
        );

        if (replacement) {
          replacement.isDefault = true;
          const savedReplacement = await repo.save(replacement);
          nextDefaultMethodId = savedReplacement.id;
        }
      }

      return {
        deletedId: paymentMethodId,
        nextDefaultMethodId,
      };
    });
  }

  toPaymentMethodView(method: PaymentMethodEntity, canDelete = true): PaymentMethodView {
    const vaultMetadata = this.extractPayPalVaultMetadata(method.metadata);
    const payerEmail =
      method.type === PaymentMethodType.PAYPAL_ACCOUNT
      && typeof method.paypalEmail === 'string'
      && method.paypalEmail.trim()
        ? method.paypalEmail.trim()
        : typeof vaultMetadata.payerEmail === 'string' && vaultMetadata.payerEmail.trim()
          ? vaultMetadata.payerEmail.trim()
          : null;
    const vaultStatus =
      typeof vaultMetadata.status === 'string' && vaultMetadata.status.trim()
        ? vaultMetadata.status.trim()
        : null;
    const fastCheckoutReady = Boolean(
      method.type === PaymentMethodType.PAYPAL_ACCOUNT
      && typeof vaultMetadata.customerId === 'string'
      && vaultMetadata.customerId.trim(),
    );

    return {
      id: method.id,
      type: method.type,
      displayName: method.displayName,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      canDelete,
      fastCheckoutReady,
      vaultStatus,
      paypalEmail: payerEmail,
      cardBrand: method.cardBrand,
      cardLast4: method.cardLast4,
      cardholderName: method.cardholderName,
      cardExpiryMonth: method.cardExpiryMonth,
      cardExpiryYear: method.cardExpiryYear,
      bankName: method.bankName,
      bankCode: method.bankCode,
      branchName: method.branchName,
      accountNumberMasked: this.maskAccountNumber(method.accountNumber),
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private extractPayPalVaultMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const rawVault = metadata.paypalVault;
    if (rawVault && typeof rawVault === 'object') {
      return rawVault as Record<string, unknown>;
    }

    return {};
  }

  private buildUpdatePayload(
    method: PaymentMethodEntity,
    dto: CreatePaymentMethodDto,
  ): CreatePaymentMethodDto {
    if (method.type === PaymentMethodType.PAYPAL_ACCOUNT) {
      return {
        type: method.type,
        displayName: dto.displayName ?? method.displayName,
        paypalEmail: dto.paypalEmail?.trim() || method.paypalEmail || undefined,
        isDefault: dto.isDefault ?? method.isDefault,
      };
    }

    if (method.type === PaymentMethodType.CARD_ACCOUNT) {
      return {
        type: method.type,
        displayName: dto.displayName ?? method.displayName,
        cardBrand: dto.cardBrand?.trim() || method.cardBrand || undefined,
        cardLast4: dto.cardLast4?.trim() || method.cardLast4 || undefined,
        cardholderName: dto.cardholderName?.trim() || method.cardholderName || undefined,
        cardExpiryMonth: dto.cardExpiryMonth ?? method.cardExpiryMonth ?? undefined,
        cardExpiryYear: dto.cardExpiryYear ?? method.cardExpiryYear ?? undefined,
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

  private assertMethodPayload(dto: CreatePaymentMethodDto): void {
    if (dto.type === PaymentMethodType.PAYPAL_ACCOUNT) {
      if (!dto.paypalEmail?.trim()) {
        throw new BadRequestException('paypalEmail is required for PAYPAL_ACCOUNT');
      }
      return;
    }

    if (dto.type === PaymentMethodType.CARD_ACCOUNT) {
      if (!dto.cardBrand?.trim()) {
        throw new BadRequestException('cardBrand is required for CARD_ACCOUNT');
      }
      if (!dto.cardLast4?.trim() || !/^\d{4}$/.test(dto.cardLast4.trim())) {
        throw new BadRequestException('cardLast4 must be the last 4 digits for CARD_ACCOUNT');
      }
      if (!dto.cardholderName?.trim()) {
        throw new BadRequestException('cardholderName is required for CARD_ACCOUNT');
      }
      if (!dto.cardExpiryMonth || dto.cardExpiryMonth < 1 || dto.cardExpiryMonth > 12) {
        throw new BadRequestException('cardExpiryMonth must be between 1 and 12 for CARD_ACCOUNT');
      }
      if (!dto.cardExpiryYear || dto.cardExpiryYear < 2024) {
        throw new BadRequestException('cardExpiryYear is invalid for CARD_ACCOUNT');
      }
      this.assertCardExpiryNotPast(dto.cardExpiryMonth, dto.cardExpiryYear);
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

  private buildDisplayName(dto: CreatePaymentMethodDto): string {
    const explicit = dto.displayName?.trim();
    if (explicit) {
      return explicit;
    }

    if (dto.type === PaymentMethodType.PAYPAL_ACCOUNT) {
      return dto.paypalEmail!.trim();
    }

    if (dto.type === PaymentMethodType.CARD_ACCOUNT) {
      const brand = dto.cardBrand!.trim();
      return `${brand} •••• ${dto.cardLast4!.trim()}`;
    }

    const masked = this.maskAccountNumber(dto.accountNumber?.trim() || null) ?? 'Bank account';
    return `${dto.bankName!.trim()} ${masked}`.trim();
  }

  private isFundingMethodType(type: PaymentMethodType): boolean {
    return (
      type === PaymentMethodType.PAYPAL_ACCOUNT
      || type === PaymentMethodType.CARD_ACCOUNT
    );
  }

  private belongsToSameMethodLane(
    candidateType: PaymentMethodType,
    deletedType: PaymentMethodType,
  ): boolean {
    if (this.isFundingMethodType(deletedType)) {
      return this.isFundingMethodType(candidateType);
    }

    return candidateType === PaymentMethodType.BANK_ACCOUNT;
  }

  private assertCardExpiryNotPast(month: number, year: number): void {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new BadRequestException('card expiry cannot be in the past');
    }
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

  private async buildFundingHistoryMap(
    paymentMethodIds: string[],
  ): Promise<Map<string, number>> {
    if (paymentMethodIds.length === 0) {
      return new Map();
    }

    const rows = await this.dataSource
      .getRepository(FundingIntentEntity)
      .createQueryBuilder('intent')
      .select('intent.paymentMethodId', 'paymentMethodId')
      .addSelect('COUNT(*)', 'count')
      .where('intent.paymentMethodId IN (:...paymentMethodIds)', { paymentMethodIds })
      .groupBy('intent.paymentMethodId')
      .getRawMany<{ paymentMethodId: string; count: string }>();

    return new Map(
      rows.map((row) => [row.paymentMethodId, Number(row.count)]),
    );
  }
}
