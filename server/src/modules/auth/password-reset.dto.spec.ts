import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from './dto/password-reset.dto';

const getMessages = async (dtoClass: new () => object, payload: Record<string, unknown>) => {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto as object);

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('ForgotPasswordDto', () => {
  it('accepts a valid forgot-password payload', async () => {
    const messages = await getMessages(ForgotPasswordDto, {
      email: 'member@gmail.com',
    });

    expect(messages).toHaveLength(0);
  });

  it('rejects an invalid email address', async () => {
    const messages = await getMessages(ForgotPasswordDto, {
      email: 'bad-email',
    });

    expect(messages).toContain('Invalid email address');
  });

  it('rejects an empty email value', async () => {
    const messages = await getMessages(ForgotPasswordDto, {
      email: '',
    });

    expect(messages).toContain('Email cannot be empty');
  });
});

describe('VerifyOtpDto', () => {
  it('accepts a valid verify-otp payload', async () => {
    const messages = await getMessages(VerifyOtpDto, {
      email: 'member@gmail.com',
      otp: '123456',
    });

    expect(messages).toHaveLength(0);
  });

  it('rejects OTP values that are not six digits', async () => {
    const messages = await getMessages(VerifyOtpDto, {
      email: 'member@gmail.com',
      otp: '12345',
    });

    expect(messages).toContain('OTP must be 6 digits');
  });

  it('rejects an empty OTP value', async () => {
    const messages = await getMessages(VerifyOtpDto, {
      email: 'member@gmail.com',
      otp: '',
    });

    expect(messages).toContain('OTP cannot be empty');
  });
});

describe('ResetPasswordDto', () => {
  it('accepts a valid reset-password payload', async () => {
    const messages = await getMessages(ResetPasswordDto, {
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });

    expect(messages).toHaveLength(0);
  });

  it('rejects passwords shorter than eight characters', async () => {
    const messages = await getMessages(ResetPasswordDto, {
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'short1',
      confirmPassword: 'short1',
    });

    expect(messages).toContain('Password must be at least 8 characters');
  });

  it('rejects passwords without a lowercase letter and number or special character', async () => {
    const messages = await getMessages(ResetPasswordDto, {
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'ALLUPPERCASE',
      confirmPassword: 'ALLUPPERCASE',
    });

    expect(messages).toContain(
      'Password must contain at least one lowercase letter and one number or special character (@$!%*?&)',
    );
  });

  it('rejects an empty confirmation password', async () => {
    const messages = await getMessages(ResetPasswordDto, {
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'newpass123',
      confirmPassword: '',
    });

    expect(messages).toContain('Password confirmation cannot be empty');
  });
});
