import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateProfileDto } from './dto/update-profile.dto';

const createPayload = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Updated User',
  phoneNumber: '0987654321',
  bio: 'Profile bio',
  companyName: 'Profile Co',
  skills: ['NestJS', 'TypeScript'],
  portfolioLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
  linkedinUrl: 'https://www.linkedin.com/in/updated-user',
  cvUrl: 'https://cdn.example.com/cv.pdf',
  timeZone: 'Asia/Bangkok',
  ...overrides,
});

const getMessages = async (payload: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateProfileDto, payload);
  const errors = await validate(dto);

  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...error.children.flatMap((child) => Object.values(child.constraints ?? {})),
  ]);
};

describe('UpdateProfileDto', () => {
  it('accepts a valid partial profile update payload', async () => {
    const messages = await getMessages(createPayload());

    expect(messages).toHaveLength(0);
  });

  it('rejects an invalid phone number', async () => {
    const messages = await getMessages(
      createPayload({
        phoneNumber: '12345',
      }),
    );

    expect(messages).toContain('Số điện thoại phải là 10-11 chữ số');
  });

  it('rejects a bio longer than 500 characters', async () => {
    const messages = await getMessages(
      createPayload({
        bio: 'a'.repeat(501),
      }),
    );

    expect(messages).toContain('Bio không được vượt quá 500 ký tự');
  });

  it('accepts a bio exactly 500 characters long', async () => {
    const messages = await getMessages(
      createPayload({
        bio: 'a'.repeat(500),
      }),
    );

    expect(messages).toHaveLength(0);
  });
});
