import { Equals, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptVerdictDto {
  @IsBoolean()
  @Equals(true, { message: 'You must confirm the verdict acceptance statement' })
  disclaimerAccepted: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Accepting the verdict requires waiving your appeal rights' })
  waiveAppealRights: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  disclaimerVersion?: string;
}
