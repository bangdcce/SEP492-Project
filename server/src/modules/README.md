# Modules

Thư mục này chứa các feature modules của ứng dụng.

## Cấu trúc module chuẩn

Mỗi module nên có cấu trúc sau:

```
modules/
  feature-name/
    dto/
      create-feature.dto.ts
      update-feature.dto.ts
    feature.controller.ts
    feature.service.ts
    feature.module.ts
    feature.controller.spec.ts
    feature.service.spec.ts
```

## Các modules mẫu

### Auth Module
Xử lý authentication và authorization:
- Login/Register
- JWT tokens
- Password reset
- Email verification

### Users Module
Quản lý user CRUD operations:
- Create, Read, Update, Delete users
- User profiles
- User roles & permissions
