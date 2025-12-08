# Database

Thư mục quản lý database schema, migrations, và seed data.

## Cấu trúc

### `/entities`
TypeORM entities - định nghĩa database schema
- `base.entity.ts` - Base entity với common fields (id, createdAt, updatedAt)
- Các entity khác extend từ base entity

### `/migrations`
Database migrations - version control cho database schema
```bash
# Tạo migration mới
yarn typeorm migration:generate -- -n MigrationName

# Chạy migrations
yarn typeorm migration:run

# Revert migration
yarn typeorm migration:revert
```

### `/seeds`
Seed data cho development và testing
```bash
# Chạy seeds
yarn seed
```

## Supabase Connection

Project sử dụng Supabase PostgreSQL. Connection string format:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Lấy connection details từ Supabase Dashboard > Project Settings > Database
