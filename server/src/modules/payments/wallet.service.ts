import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TransactionEntity, WalletEntity } from '../../database/entities';
import {
  WalletSnapshot,
  WalletTransactionItem,
  WalletTransactionsResult,
} from './payments.types';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  async getOrCreateWallet(
    userId: string,
    currency = 'USD',
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const existing = await walletRepo.findOne({
      where: { userId },
    });

    if (existing) {
      if (existing.currency !== currency) {
        if (this.hasFinancialActivity(existing)) {
          throw new BadRequestException(
            `Wallet currency mismatch. Expected ${existing.currency}, received ${currency}.`,
          );
        }
        existing.currency = currency;
        return walletRepo.save(existing);
      }
      return existing;
    }

    const wallet = walletRepo.create({
      userId,
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency,
    });
    return walletRepo.save(wallet);
  }

  async getWalletSnapshot(userId: string): Promise<WalletSnapshot> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.toWalletSnapshot(wallet);
  }

  async listTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<WalletTransactionsResult> {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const wallet = await this.getOrCreateWallet(userId);

    const [items, total] = await this.transactionRepository.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      wallet: this.toWalletSnapshot(wallet),
      items: items.map((item) => this.toWalletTransaction(item)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  toWalletSnapshot(wallet: WalletEntity): WalletSnapshot {
    return {
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: Number(wallet.balance || 0),
      pendingBalance: Number(wallet.pendingBalance || 0),
      heldBalance: Number(wallet.heldBalance || 0),
      totalDeposited: Number(wallet.totalDeposited || 0),
      totalWithdrawn: Number(wallet.totalWithdrawn || 0),
      totalEarned: Number(wallet.totalEarned || 0),
      totalSpent: Number(wallet.totalSpent || 0),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  toWalletTransaction(transaction: TransactionEntity): WalletTransactionItem {
    return {
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      fee: Number(transaction.fee || 0),
      netAmount: transaction.netAmount === null ? null : Number(transaction.netAmount || 0),
      currency: transaction.currency,
      type: transaction.type,
      status: transaction.status,
      referenceType: transaction.referenceType || null,
      referenceId: transaction.referenceId || null,
      paymentMethod: transaction.paymentMethod || null,
      externalTransactionId: transaction.externalTransactionId || null,
      balanceAfter:
        transaction.balanceAfter === null ? null : Number(transaction.balanceAfter || 0),
      description: transaction.description || null,
      failureReason: transaction.failureReason || null,
      metadata: (transaction.metadata as Record<string, unknown> | null) ?? null,
      relatedTransactionId: transaction.relatedTransactionId || null,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt || null,
    };
  }

  private hasFinancialActivity(wallet: WalletEntity): boolean {
    return [
      wallet.balance,
      wallet.pendingBalance,
      wallet.heldBalance,
      wallet.totalDeposited,
      wallet.totalWithdrawn,
      wallet.totalEarned,
      wallet.totalSpent,
    ].some((value) => Number(value || 0) !== 0);
  }
}
