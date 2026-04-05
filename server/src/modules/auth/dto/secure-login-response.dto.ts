import { ApiProperty } from '@nestjs/swagger';
import { AuthResponseDto } from './auth-response.dto';

/**
 * Secure Login Response DTO - Refresh token is stored in an httpOnly cookie.
 * Access token is returned in the response body for API authorization.
 */
export class SecureLoginResponseDto {
  @ApiProperty({ description: 'User information', type: AuthResponseDto })
  user: AuthResponseDto;

  @ApiProperty({
    description: 'Access token used to authorize API calls (store in memory only)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  // The refresh token is stored in an httpOnly cookie and is not returned in the response body.
}
