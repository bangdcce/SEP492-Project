import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { UserStatus } from '../../database/entities/user.entity';
import { EmailVerificationService } from './email-verification.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('EmailVerificationService.verifyEmail', () => {
  let service: EmailVerificationService;
  let userRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepository = createRepositoryMock();

    service = new EmailVerificationService(userRepository as any, {
      get: jest.fn(),
    } as any);
  });

  it('verifies the email when the token is valid and clears verification fields', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'member@gmail.com',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      emailVerificationExpires: expiresAt,
    });
    userRepository.update.mockResolvedValue(undefined);

    const before = new Date();
    const result = await service.verifyEmail('valid-token');
    const after = new Date();

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { emailVerificationToken: 'valid-token' },
    });
    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        emailVerificationToken: null,
        emailVerificationExpires: null,
        isVerified: false,
      }),
    );

    const updatePayload = userRepository.update.mock.calls[0][1];
    expect(updatePayload.emailVerifiedAt).toBeInstanceOf(Date);
    expect(updatePayload.emailVerifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatePayload.emailVerifiedAt.getTime()).toBeLessThanOrEqual(after.getTime());

    expect(result).toEqual({
      message: 'Email verified successfully',
      email: 'member@gmail.com',
    });
  });

  it('rejects when the token is missing', async () => {
    await expect(service.verifyEmail('')).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when the token does not match any user', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.verifyEmail('invalid-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when the account has been deleted', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'deleted-user',
      email: 'deleted@gmail.com',
      status: UserStatus.DELETED,
      emailVerifiedAt: null,
      emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(service.verifyEmail('deleted-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when the email has already been verified', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'verified-user',
      email: 'verified@gmail.com',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-03-20T10:00:00.000Z'),
      emailVerificationExpires: new Date('2026-04-01T10:00:00.000Z'),
    });

    await expect(service.verifyEmail('verified-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when the token has expired', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'expired-user',
      email: 'expired@gmail.com',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      emailVerificationExpires: new Date(Date.now() - 60 * 60 * 1000),
    });

    await expect(service.verifyEmail('expired-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });
});

describe('EmailVerificationService.resendVerificationEmail', () => {
  let service: EmailVerificationService;
  let userRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepository = createRepositoryMock();

    service = new EmailVerificationService(userRepository as any, {
      get: jest.fn(),
    } as any);
  });

  it('resends verification email when the user exists and is not verified', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'member@gmail.com',
      emailVerifiedAt: null,
      emailVerificationExpires: null,
    });

    const sendVerificationEmailSpy = jest
      .spyOn(service, 'sendVerificationEmail')
      .mockResolvedValue(undefined);

    const result = await service.resendVerificationEmail('member@gmail.com');

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'member@gmail.com' },
    });
    expect(sendVerificationEmailSpy).toHaveBeenCalledWith('user-1', 'member@gmail.com');
    expect(result).toEqual({
      message: 'Verification email sent. Please check your inbox.',
    });
  });

  it('normalizes email before attempting to resend verification mail', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'member@gmail.com',
      emailVerifiedAt: null,
      emailVerificationExpires: null,
    });

    const sendVerificationEmailSpy = jest
      .spyOn(service, 'sendVerificationEmail')
      .mockResolvedValue(undefined);

    await service.resendVerificationEmail('  MEMBER@GMAIL.COM  ');

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'member@gmail.com' },
    });
    expect(sendVerificationEmailSpy).toHaveBeenCalledWith('user-1', 'member@gmail.com');
  });

  it('allows resend when the previous verification window is below the cooldown threshold', async () => {
    const futureDate = new Date(Date.now() + 22 * 60 * 60 * 1000);

    userRepository.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'cooldown-ok@gmail.com',
      emailVerifiedAt: null,
      emailVerificationExpires: futureDate,
    });

    const sendVerificationEmailSpy = jest
      .spyOn(service, 'sendVerificationEmail')
      .mockResolvedValue(undefined);

    const result = await service.resendVerificationEmail('cooldown-ok@gmail.com');

    expect(sendVerificationEmailSpy).toHaveBeenCalledWith('user-2', 'cooldown-ok@gmail.com');
    expect(result.message).toBe('Verification email sent. Please check your inbox.');
  });

  it('rejects when the email does not belong to any user', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.resendVerificationEmail('missing@gmail.com')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects when the email has already been verified', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-3',
      email: 'verified@gmail.com',
      emailVerifiedAt: new Date('2026-03-20T10:00:00.000Z'),
      emailVerificationExpires: null,
    });

    await expect(service.resendVerificationEmail('verified@gmail.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when the resend request arrives too soon after the previous email', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    userRepository.findOne.mockResolvedValue({
      id: 'user-4',
      email: 'cooldown-blocked@gmail.com',
      emailVerifiedAt: null,
      emailVerificationExpires: futureDate,
    });

    const sendVerificationEmailSpy = jest
      .spyOn(service, 'sendVerificationEmail')
      .mockResolvedValue(undefined);

    await expect(
      service.resendVerificationEmail('cooldown-blocked@gmail.com'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendVerificationEmailSpy).not.toHaveBeenCalled();
  });
});
