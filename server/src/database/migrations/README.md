# 🗃️ Database Migrations

Folder này chứa **TypeORM migrations** - các file quản lý thay đổi database schema.

## 📋 Files

### `1733686800000-InitialSchema.ts`
**Initial migration** - Tạo tables:
- `users` - User accounts
- `refresh_tokens` - JWT refresh tokens

## 🚀 How to Use

### Run All Pending Migrations
```bash
cd ../../../ # Go to server root
yarn typeorm migration:run
```

### Create New Migration
```bash
# Update entity first, then:
yarn typeorm migration:generate -n DescriptionHere
```

### Revert Last Migration
```bash
yarn typeorm migration:revert
```

## 📚 Learn More
Read: `../../MIGRATIONS_GUIDE.md`

---

**All migrations should be committed to git!**
