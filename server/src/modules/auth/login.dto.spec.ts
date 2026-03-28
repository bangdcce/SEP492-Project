import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from './dto/login.dto';

const createPayload = (overrides: Record<string, unknown> = {}) => ({
  email: 'member@gmail.com',
  password: 'SecurePass123!',
  ...overrides,
});

const getMessages = async (payload: Record<string, unknown>) => {
  const dto = plainToInstance(LoginDto, payload);
  const errors = await validate(dto);

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('LoginDto', () => {
  it('accepts a valid login payload', async () => {
    const messages = await getMessages(createPayload());

    expect(messages).toHaveLength(0);
  });

  it('rejects an invalid email format', async () => {
    const messages = await getMessages(
      createPayload({
        email: 'bad-email',
      }),
    );

    expect(messages).toContain('Invalid email format');
  });

  it('rejects a missing email value', async () => {
    const messages = await getMessages(
      createPayload({
        email: '',
      }),
    );

    expect(messages).toContain('Email is required');
  });

  it('rejects passwords shorter than eight characters', async () => {
    const messages = await getMessages(
      createPayload({
        password: 'short',
      }),
    );

    expect(messages).toContain('Password must be at least 8 characters');
  });

  it('rejects non-string password values', async () => {
    const messages = await getMessages(
      createPayload({
        password: 12345678,
      }),
    );

    expect(messages).toContain('Password must be a string');
  });
});
