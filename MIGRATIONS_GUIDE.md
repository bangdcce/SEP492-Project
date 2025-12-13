# 🗃️ TypeORM Migrations Guide

## 📌 Overview

Migrations cho phép bạn **kiểm soát thay đổi database schema** mà không cần `DB_SYNCHRONIZE=true`.

### ✅ Lợi Ích:
- ✓ Version control cho database schema
- ✓ Dễ collaborate với team
- ✓ Safe rollback nếu có lỗi
- ✓ Production-ready
- ✓ Không auto-sync, tính toán mọi thay đổi

---

## 🚀 Quick Start

### 1️⃣ Tạo Migration Mới

```bash
# Đi vào server folder
cd server

# Tạo migration (tự động tìm changes)
yarn typeorm migration:generate -n CreateUsersTable

# Hoặc tạo trống (tự viết)
yarn typeorm migration:create -n CreateUsersTable
```

### 2️⃣ Chạy Migration

```bash
# Chạy tất cả pending migrations
yarn typeorm migration:run

# Hoặc từ main.ts của NestJS
# Nó sẽ chạy auto khi startup
```

### 3️⃣ Rollback Migration

```bash
# Undo migration cuối cùng
yarn typeorm migration:revert
```

---

## 📝 Ví Dụ: Thêm Column Mới

### Step 1: Update Entity

File: `server/src/modules/users/entities/user.entity.ts`
```typescript
import { Entity, Column } from 'typeorm';

@Entity('users')
export class User {
  @Column({ type: 'varchar', length: 255, nullable: true })
  phone: string; // Thêm cái này
}
```

### Step 2: Generate Migration

```bash
cd server
yarn migration:generate src/database/migrations/UpdateDatabase  
```

**Nó sẽ tạo file:** `src/database/migrations/1733686800001-AddPhoneToUsers.ts`

### Step 3: Review Migration File

```typescript
// auto-generated
export class AddPhoneToUsers1733686800001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'phone',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'phone');
  }
}
```

### Step 4: Run Migration

```bash
yarn typeorm migration:run
```

✅ **Column `phone` đã được thêm vào database!**

---

## 🔄 Migration Lifecycle

```
┌─────────────────────────────────────────────┐
│  1. Thay đổi Entity (.entity.ts)           │
├─────────────────────────────────────────────┤
│  ↓                                          │
│  2. Generate Migration                      │
│     yarn typeorm migration:generate         │
├─────────────────────────────────────────────┤
│  ↓                                          │
│  3. Review Migration File                   │
│     Kiểm tra up() và down()                │
├─────────────────────────────────────────────┤
│  ↓                                          │
│  4. Run Migration                           │
│     yarn typeorm migration:run              │
├─────────────────────────────────────────────┤
│  ✅ Database Schema Updated!                │
└─────────────────────────────────────────────┘
```

---

## 📂 Migration File Structure

```
server/src/database/migrations/
├── 1733686800000-InitialSchema.ts
├── 1733686800001-AddPhoneToUsers.ts
├── 1733686800002-CreatePostsTable.ts
└── ...
```

### File Naming:
```
{TIMESTAMP}-{DescriptiveName}.ts
```

**Ví dụ:**
- ✅ `1733686800000-InitialSchema.ts`
- ✅ `1733686800001-AddPhoneToUsers.ts`
- ✅ `1733686800002-CreatePostsTable.ts`
- ❌ `AddPhone.ts` (không có timestamp)

---

## 🛠️ Common Commands

```bash
# Generate migration từ entity changes
yarn typeorm migration:generate -n DescriptionHere

# Create trống migration
yarn typeorm migration:create -n DescriptionHere

# Run pending migrations
yarn typeorm migration:run

# Show pending migrations
yarn typeorm migration:show

# Revert (undo) last migration
yarn typeorm migration:revert

# Show migration history
yarn typeorm migration:show
```

---

## 🔧 Setup Tự Động (Optional)

### Chạy Migrations Auto khi Startup:

File: `server/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppDataSource } from './database/data-source';

async function bootstrap() {
  // Chạy migrations
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### Hoặc Chạy Manual:

```bash
# Trước khi chạy app
yarn typeorm migration:run

# Rồi chạy app
yarn start:dev
```

---

## ⚠️ Best Practices

### ✅ DO:
```bash
✓ Commit migrations vào git
✓ Review migration file trước khi run
✓ Test migrations trên dev trước prod
✓ Giữ migration file immutable (không edit sau khi commit)
✓ Tạo migration cho mỗi thay đổi schema
```

### ❌ DON'T:
```bash
✗ Edit migration file sau khi chạy
✗ Dùng DB_SYNCHRONIZE=true ở production
✗ Skip migration (chạy app mà chưa migrate)
✗ Xóa migration file
✗ Modify entity mà quên tạo migration
```

---

## 🆘 Troubleshooting

### "Migration không chạy"
```bash
# Check pending migrations
yarn typeorm migration:show

# Nếu migration file không visible:
# - Kiểm tra path trong data-source.ts
# - Kiểm tra .env variables
```

### "Cannot find module error"
```bash
# Chạy yarn install trước
yarn install

# Rồi compile TypeScript
yarn build

# Rồi chạy migration
yarn typeorm migration:run
```

### "Conflict với existing tables"
```bash
# Nếu table đã tồn tại:
# Kiểm tra data-source.ts
# Bỏ 'ifNotExists: true' nếu cần update table

await queryRunner.createTable(new Table({...}), false); // false = error nếu tồn tại
```

---

## 📚 File References

- **Migrations folder:** `server/src/database/migrations/`
- **Data Source config:** `server/src/database/data-source.ts`
- **Entity example:** `server/src/modules/users/entities/user.entity.ts`
- **Main entry:** `server/src/main.ts`

---

## 🎯 Next Steps

1. ✅ Chạy initial migration:
   ```bash
   cd server
   yarn typeorm migration:run
   ```

2. ✅ Verify tables created:
   ```bash
   # Từ Supabase Dashboard
   # Bạn sẽ thấy: users, refresh_tokens tables
   ```

3. ✅ Khi cần thay đổi schema:
   ```bash
   # 1. Update entity
   # 2. yarn typeorm migration:generate -n DescriptiveName
   # 3. yarn typeorm migration:run
   ```

---

**Xong! Database của bạn giờ được quản lý bằng migrations!** 🎉

Mỗi thay đổi schema bây giờ cần:
1. Update entity
2. Generate migration
3. Run migration

Không còn auto-sync nữa! 🚀
