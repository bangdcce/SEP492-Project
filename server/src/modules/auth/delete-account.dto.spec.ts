import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DeleteAccountDto } from './dto/delete-account.dto';

const getMessages = async (payload: Record<string, unknown>) => {
  const dto = plainToInstance(DeleteAccountDto, payload);
  const errors = await validate(dto as object);

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('DeleteAccountDto', () => {
  it('accepts a valid delete-account payload', async () => {
    const messages = await getMessages({
      password: 'currentPassword123',
      reason: 'No longer need the service',
    });

    expect(messages).toHaveLength(0);
  });

  it('rejects an empty password', async () => {
    const messages = await getMessages({
      password: '',
    });

    expect(messages).toContain('Password is required');
  });

  it('rejects passwords shorter than six characters', async () => {
    const messages = await getMessages({
      password: '12345',
    });

    expect(messages).toContain('Password must be at least 6 characters');
  });

  it('rejects reasons longer than five hundred characters', async () => {
    const messages = await getMessages({
      password: 'currentPassword123',
      reason: 'a'.repeat(501),
    });

    expect(messages).toContain('Reason must be at most 500 characters');
  });
});
