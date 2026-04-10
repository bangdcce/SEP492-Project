import { Transform, plainToInstance } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

type FollowUpActionLike = {
  code?: unknown;
  label?: unknown;
  ownerRole?: unknown;
  dueAt?: unknown;
  urgent?: unknown;
  note?: unknown;
};

export class FollowUpActionDto {
  @IsString()
  @MaxLength(120)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ownerRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

const normalizeSingleFollowUpAction = (
  item: unknown,
): FollowUpActionLike | null => {
  if (!item) {
    return null;
  }

  if (typeof item === 'string') {
    const code = item.trim().toUpperCase();
    return code ? { code } : null;
  }

  if (typeof item !== 'object') {
    return null;
  }

  const current = item as FollowUpActionLike;
  const code = String(current.code ?? '')
    .trim()
    .toUpperCase();

  if (!code) {
    return null;
  }

  return {
    code,
    label:
      typeof current.label === 'string' && current.label.trim().length > 0
        ? current.label.trim()
        : undefined,
    ownerRole:
      typeof current.ownerRole === 'string' && current.ownerRole.trim().length > 0
        ? current.ownerRole.trim().toUpperCase()
        : undefined,
    dueAt:
      current.dueAt === null
        ? null
        : typeof current.dueAt === 'string' && current.dueAt.trim().length > 0
          ? current.dueAt.trim()
          : undefined,
    urgent:
      typeof current.urgent === 'boolean' ? current.urgent : undefined,
    note:
      current.note === null
        ? null
        : typeof current.note === 'string' && current.note.trim().length > 0
          ? current.note.trim()
          : undefined,
  };
};

export const TransformFollowUpActions = () =>
  Transform(
    ({ value }) => {
      if (!Array.isArray(value)) {
        return [];
      }

      const normalized = value
        .map((item) => normalizeSingleFollowUpAction(item))
        .filter((item): item is FollowUpActionLike => Boolean(item));

      // Keep nested values as class instances so whitelist + ValidateNested
      // recognizes FollowUpActionDto fields instead of rejecting them.
      return plainToInstance(FollowUpActionDto, normalized);
    },
    { toClassOnly: true },
  );
