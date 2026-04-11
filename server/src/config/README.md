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
- `VIRUSTOTAL_FAIL_OPEN` (optional, default: `true`): Khi VirusTotal timeout/lỗi hệ thống, cho phép upload tiếp (`true`) hoặc chặn (`false`).
- `VIRUSTOTAL_REQUEST_TIMEOUT_MS` (optional, default: `5000`): Timeout cho mỗi request tới VirusTotal.
- `VIRUSTOTAL_MAX_RETRIES` (optional, default: `2`): Số lần retry cho lỗi mạng/429/5xx.
- `VIRUSTOTAL_RETRY_BASE_DELAY_MS` (optional, default: `250`): Backoff cơ sở cho retry.
- `VIRUSTOTAL_SCAN_CACHE_TTL_SECONDS` (optional, default: `900`): TTL cache kết quả scan hash (hit).
- `VIRUSTOTAL_UNKNOWN_HASH_CACHE_TTL_SECONDS` (optional, default: `300`): TTL cache cho hash chưa có trên VirusTotal (404).
- `GITHUB_API_TOKEN` (optional): GitHub token để tăng rate limit khi verify commit hash.
