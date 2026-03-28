import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';

import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';

const createCreatePayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Marketplace request',
  description: 'Post this request to the broker marketplace',
  answers: [{ questionId: 'q-1', valueText: 'Marketplace' }],
  ...overrides,
});

const collectMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectMessages(error.children ?? []),
  ]);

const getMessages = async <T extends object>(
  dtoClass: new () => T,
  payload: Record<string, unknown>,
) => {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto);

  return collectMessages(errors);
};

describe('Project request DTO validation', () => {
  describe('CreateProjectRequestDto', () => {
    it('accepts a valid create-request payload', async () => {
      const messages = await getMessages(CreateProjectRequestDto, createCreatePayload());

      expect(messages).toHaveLength(0);
    });

    it('rejects a null title value', async () => {
      const messages = await getMessages(
        CreateProjectRequestDto,
        createCreatePayload({
          title: null,
        }),
      );

      expect(messages).toEqual(
        expect.arrayContaining(['title must be a string', 'title should not be empty']),
      );
    });

    it('rejects a null description value', async () => {
      const messages = await getMessages(
        CreateProjectRequestDto,
        createCreatePayload({
          description: null,
        }),
      );

      expect(messages).toEqual(
        expect.arrayContaining([
          'description must be a string',
          'description should not be empty',
        ]),
      );
    });

    it.each([1, 5])(
      'accepts wizardProgressStep=%s at the allowed boundary',
      async (wizardProgressStep) => {
        const messages = await getMessages(
          CreateProjectRequestDto,
          createCreatePayload({
            wizardProgressStep,
          }),
        );

        expect(messages).toHaveLength(0);
      },
    );

    it('rejects wizardProgressStep below the minimum boundary', async () => {
      const messages = await getMessages(
        CreateProjectRequestDto,
        createCreatePayload({
          wizardProgressStep: 0,
        }),
      );

      expect(messages).toContain('wizardProgressStep must not be less than 1');
    });

    it('rejects wizardProgressStep above the maximum boundary', async () => {
      const messages = await getMessages(
        CreateProjectRequestDto,
        createCreatePayload({
          wizardProgressStep: 6,
        }),
      );

      expect(messages).toContain('wizardProgressStep must not be greater than 5');
    });
  });

  describe('UpdateProjectRequestDto', () => {
    it('accepts an empty update payload', async () => {
      const messages = await getMessages(UpdateProjectRequestDto, {});

      expect(messages).toHaveLength(0);
    });

    it.each([1, 5])(
      'accepts update wizardProgressStep=%s at the allowed boundary',
      async (wizardProgressStep) => {
        const messages = await getMessages(UpdateProjectRequestDto, {
          wizardProgressStep,
        });

        expect(messages).toHaveLength(0);
      },
    );

    it('rejects update wizardProgressStep below the minimum boundary', async () => {
      const messages = await getMessages(UpdateProjectRequestDto, {
        wizardProgressStep: 0,
      });

      expect(messages).toContain('wizardProgressStep must not be less than 1');
    });

    it('rejects update wizardProgressStep above the maximum boundary', async () => {
      const messages = await getMessages(UpdateProjectRequestDto, {
        wizardProgressStep: 6,
      });

      expect(messages).toContain('wizardProgressStep must not be greater than 5');
    });
  });
});
