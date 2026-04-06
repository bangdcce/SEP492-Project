import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { StaffApplicationStatus } from '../../../database/entities/staff-application.entity';
import { ListStaffApplicationsDto } from './list-staff-applications.dto';

const createDto = (payload: Record<string, unknown>) =>
  plainToInstance(ListStaffApplicationsDto, payload);

describe('ListStaffApplicationsDto', () => {
  it('treats an empty status query as undefined so ALL does not fail validation', async () => {
    const dto = createDto({
      status: '',
      page: '1',
      limit: '20',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBeUndefined();
  });

  it('treats ALL as no status filter', async () => {
    const dto = createDto({
      status: 'ALL',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBeUndefined();
  });

  it('keeps valid status filters intact', async () => {
    const dto = createDto({
      status: StaffApplicationStatus.PENDING,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(StaffApplicationStatus.PENDING);
  });

  it('still rejects unsupported status values', async () => {
    const dto = createDto({
      status: 'INVALID',
    });

    const errors = await validate(dto);
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain(
      'status must be one of the following values: PENDING, APPROVED, REJECTED',
    );
  });
});
