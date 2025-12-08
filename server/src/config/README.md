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
