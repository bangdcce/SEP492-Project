import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../../database/entities/kyc-verification.entity';

// Custom validator: Date of birth must be at least 18 years ago
@ValidatorConstraint({ name: 'isAdult', async: false })
class IsAdultConstraint implements ValidatorConstraintInterface {
  validate(dateOfBirth: string, _args: ValidationArguments) {
    if (!dateOfBirth) return false;

    const dob = new Date(dateOfBirth);
    const today = new Date();

    // Check if date is valid
    if (isNaN(dob.getTime())) return false;

    // Check if date is not in the future
    if (dob > today) return false;

    // Calculate age
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    // Must be at least 18 years old
    return age >= 18;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Date of birth is invalid. You must be at least 18 years old.';
  }
}

// Custom validator: Document expiry date must be in the future
@ValidatorConstraint({ name: 'isFutureDate', async: false })
class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(expiryDate: string, _args: ValidationArguments) {
    if (!expiryDate) return true; // Optional field

    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates only

    // Check if date is valid
    if (isNaN(expiry.getTime())) return false;

    // Must be in the future
    return expiry > today;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Document has expired. Please provide a valid document with future expiry date.';
  }
}

export class SubmitKycDto {
  @ApiProperty({
    description: 'Full name shown on the identity document',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  fullNameOnDocument: string;

  @ApiProperty({
    description: 'Identity document number or passport number',
    example: '001234567890',
  })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiProperty({
    description: 'Document type',
    enum: ['CCCD', 'PASSPORT', 'DRIVER_LICENSE'],
    example: 'CCCD',
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Date of birth (must be at least 18 years old)',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  @Validate(IsAdultConstraint)
  dateOfBirth: string;

  @ApiPropertyOptional({
    description: 'Document expiry date (must still be valid)',
    example: '2035-01-01',
  })
  @IsDateString()
  @IsOptional()
  @Validate(IsFutureDateConstraint)
  documentExpiryDate?: string;

  @ApiPropertyOptional({
    description: 'Permanent address',
    example: '123 Street, Ward, District, City',
  })
  @IsString()
  @IsOptional()
  address?: string;
}
