import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UserRole } from '../../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

const createPayload = (overrides: Record<string, unknown> = {}) => ({
  email: 'new.user@gmail.com',
  password: 'securepass1',
  fullName: 'New User',
  phoneNumber: '0987654321',
  role: UserRole.CLIENT,
  acceptTerms: true,
  acceptPrivacy: true,
  ...overrides,
});

const getMessages = async (payload: Record<string, unknown>) => {
  const dto = plainToInstance(RegisterDto, payload);
  const errors = await validate(dto);

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('RegisterDto', () => {
  it('accepts a valid self-registration payload', async () => {
    const messages = await getMessages(createPayload());

    expect(messages).toHaveLength(0);
  });

  it('rejects malformed email addresses before business logic runs', async () => {
    const messages = await getMessages(
      createPayload({
        email: 'invalid-email',
      }),
    );

    expect(messages).toContain('Invalid email format');
  });

  it('rejects roles outside the self-registration allowlist', async () => {
    const messages = await getMessages(
      createPayload({
        role: UserRole.ADMIN,
      }),
    );

    expect(messages).toContain('Role must be CLIENT, BROKER, FREELANCER, or STAFF');
  });

  it('accepts staff as a self-registration role', async () => {
    const messages = await getMessages(
      createPayload({
        role: UserRole.STAFF,
      }),
    );

    expect(messages).toHaveLength(0);
  });

  it('rejects an invalid Vietnamese phone number', async () => {
    const messages = await getMessages(
      createPayload({
        phoneNumber: '12345',
      }),
    );

    expect(messages).toContain(
      'Invalid phone number format. Correct format: 0[3|5|7|8|9]xxxxxxxx (e.g., 0987654321)',
    );
  });

  it('rejects full names that contain unsupported characters', async () => {
    const messages = await getMessages(
      createPayload({
        fullName: 'New User 123',
      }),
    );

    expect(messages).toContain('Full name can only contain letters and spaces');
  });

  it('rejects email domains outside the trusted-provider list', async () => {
    const messages = await getMessages(
      createPayload({
        email: 'new.user@mailinator.com',
      }),
    );

    expect(messages).toContain(
      'Please use an email from a reputable provider (Gmail, Outlook, Yahoo, etc.) or university email.',
    );
  });

  it('rejects passwords that miss the required numeric or special character', async () => {
    const messages = await getMessages(
      createPayload({
        password: 'securepass',
      }),
    );

    expect(messages).toContain(
      'Password must contain at least one lowercase letter and one number or special character (@$!%*?&)',
    );
  });
});
