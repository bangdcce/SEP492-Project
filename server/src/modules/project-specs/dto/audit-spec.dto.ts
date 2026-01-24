import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum AuditAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class AuditSpecDto {
  /**
   * Action to perform: APPROVE or REJECT
   */
  @IsEnum(AuditAction)
  @IsNotEmpty()
  action: AuditAction;

  /**
   * Reason for rejection (required if action is REJECT)
   */
  @IsString()
  @IsOptional()
  reason?: string;
}
