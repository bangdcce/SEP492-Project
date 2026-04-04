import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DocumentType } from '../../database/entities/kyc-verification.entity';
import { SubmitKycDto } from './dto';

const createDto = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(SubmitKycDto, {
    fullNameOnDocument: 'Nguyen Gia Bao',
    documentNumber: '001234567890',
    documentType: DocumentType.CCCD,
    dateOfBirth: '1999-01-01',
    documentExpiryDate: '2035-01-01',
    address: '123 Nguyen Trai, Ho Chi Minh City',
    ...overrides,
  });

describe('SubmitKycDto', () => {
  it('accepts a valid KYC submission payload', async () => {
    const errors = await validate(createDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects applicants younger than eighteen years old', async () => {
    const errors = await validate(
      createDto({
        dateOfBirth: '2010-01-01',
      }),
    );

    expect(errors.some((error) => error.property === 'dateOfBirth')).toBe(true);
  });

  it('rejects expired identity documents', async () => {
    const errors = await validate(
      createDto({
        documentExpiryDate: '2020-01-01',
      }),
    );

    expect(errors.some((error) => error.property === 'documentExpiryDate')).toBe(true);
  });

  it('rejects unsupported document types', async () => {
    const errors = await validate(
      createDto({
        documentType: 'STUDENT_CARD',
      }),
    );

    expect(errors.some((error) => error.property === 'documentType')).toBe(true);
  });
});
