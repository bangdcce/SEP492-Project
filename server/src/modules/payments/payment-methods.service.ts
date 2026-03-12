import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentMethodEntity, PaymentMethodType } from '../../database/entities';
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

    return methods.map((method) => this.toPaymentMethodView(method));
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
      return this.toPaymentMethodView(saved);
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
      return this.toPaymentMethodView(saved);
    });
  }

  toPaymentMethodView(method: PaymentMethodEntity): PaymentMethodView {
    return {
      id: method.id,
      type: method.type,
      displayName: method.displayName,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      paypalEmail: method.paypalEmail,
      bankName: method.bankName,
      accountNumberMasked: this.maskAccountNumber(method.accountNumber),
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private assertMethodPayload(dto: CreatePaymentMethodDto): void {
    if (dto.type === PaymentMethodType.PAYPAL_ACCOUNT) {
      if (!dto.paypalEmail?.trim()) {
        throw new BadRequestException('paypalEmail is required for PAYPAL_ACCOUNT');
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

  private buildDisplayName(dto: CreatePaymentMethodDto): string {
    const explicit = dto.displayName?.trim();
    if (explicit) {
      return explicit;
    }

    if (dto.type === PaymentMethodType.PAYPAL_ACCOUNT) {
      return dto.paypalEmail!.trim();
    }

    const masked = this.maskAccountNumber(dto.accountNumber?.trim() || null) ?? 'Bank account';
    return `${dto.bankName!.trim()} ${masked}`.trim();
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
}
