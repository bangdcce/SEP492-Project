import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InvitationResponseStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class RespondInvitationDto {
  @ApiProperty({ enum: InvitationResponseStatus })
  @IsEnum(InvitationResponseStatus)
  status: InvitationResponseStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
