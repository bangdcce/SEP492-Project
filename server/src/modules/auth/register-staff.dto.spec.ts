import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterStaffDto } from './dto/register-staff.dto';

const createPayload = (overrides: Record<string, unknown> = {}) => ({
  email: 'staff.user@gmail.com',
  password: 'securepass1',
  fullName: 'Staff User',
  phoneNumber: '0987654321',
  recaptchaToken: 'captcha-token',
  acceptTerms: true,
  acceptPrivacy: true,
  fullNameOnDocument: 'Staff User',
  documentType: 'CCCD',
  documentNumber: '0123456789',
  dateOfBirth: '1990-01-01',
  address: '123 Example Street',
  ...overrides,
});

const getMessages = async (payload: Record<string, unknown>) => {
  const dto = plainToInstance(RegisterStaffDto, payload);
  const errors = await validate(dto);

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('RegisterStaffDto', () => {
  it('accepts a valid staff registration payload', async () => {
    const messages = await getMessages(createPayload());
    expect(messages).toHaveLength(0);
  });

  it('requires the manual KYC text fields', async () => {
    const messages = await getMessages(
      createPayload({
        fullNameOnDocument: '',
        documentType: '',
        documentNumber: '',
        dateOfBirth: '',
        address: '',
      }),
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        'fullNameOnDocument is required',
        'documentType must be CCCD, PASSPORT, or DRIVER_LICENSE',
        'documentNumber is required',
        'dateOfBirth is required',
        'address is required',
      ]),
    );
  });

  it('transforms multipart boolean strings for terms and privacy acceptance', async () => {
    const messages = await getMessages(
      createPayload({
        acceptTerms: 'true',
        acceptPrivacy: 'true',
      }),
    );

    expect(messages).toHaveLength(0);
  });
});
