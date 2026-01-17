import { ApiProperty } from '@nestjs/swagger';
import { AuthResponseDto } from './auth-response.dto';

/**
 * Secure Login Response DTO - Refresh token is now in httpOnly cookie
 * Access token is returned in response body for API authorization
 */
export class SecureLoginResponseDto {
  @ApiProperty({ description: 'Thông tin người dùng', type: AuthResponseDto })
  user: AuthResponseDto;

  @ApiProperty({
    description: 'Access token để xác thực API calls (store in memory only)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  // refreshToken được set trong httpOnly cookie, không trả về trong response
}
