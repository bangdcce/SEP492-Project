# Config

Thư mục chứa các configuration files cho ứng dụng.

## Files

### `database.config.ts`
Cấu hình kết nối database (Supabase PostgreSQL)

### `app.config.ts`
Cấu hình chung cho application (port, environment, etc.)

### `jwt.config.ts`
Cấu hình JWT authentication

### `cors.config.ts`
Cấu hình CORS

## Sử dụng

Tất cả configs được load thông qua `@nestjs/config` module và có thể access qua `ConfigService`.

## Security Integrations

Các biến env cần thiết cho các tích hợp bảo mật:

- `VIRUSTOTAL_API_KEY`: API key cho VirusTotal (scan file hash).
- `VIRUSTOTAL_API_URL` (optional): Base URL cho VirusTotal API (default: `https://www.virustotal.com/api/v3`).
- `GITHUB_API_TOKEN` (optional): GitHub token để tăng rate limit khi verify commit hash.
