# Backend Developer Guide - NestJS 🚀

Hướng dẫn nhanh cho developer làm việc với Backend (NestJS + TypeORM + PostgreSQL).

---

## Quick Start

```bash
cd server
yarn install
yarn start:dev    # Development mode
```

---

## Cấu trúc Module

```
src/modules/[module-name]/
├── [module-name].module.ts       # Module definition
├── [module-name].controller.ts   # HTTP routes
├── [module-name].service.ts      # Business logic
└── dto/
    ├── create-[name].dto.ts      # Input validation
    └── [name]-response.dto.ts    # Response format
```

---

## Commands thường dùng

### Development

```bash
yarn start:dev          # Start with hot-reload
yarn build              # Build production
yarn start:prod         # Run production
```

### Database & Migrations

```bash
# Generate migration từ entity changes
yarn migration:generate src/database/migrations/TenMigration

# Build và chạy migration
yarn build
yarn typeorm migration:run -d dist/data-source.js

# Revert migration cuối
yarn typeorm migration:revert -d dist/data-source.js

# Xem status
yarn typeorm migration:show -d dist/data-source.js
```

---

## Tạo Entity

```typescript
// src/database/entities/[name].entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('table_name') // Tên bảng: plural, snake_case
export class ExampleEntity {
  // ID: Dùng UUID cho consistency
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Foreign Key
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Relationship
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  // String column
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Nullable column
  @Column({ type: 'text', nullable: true })
  description: string;

  // JSON data
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Enum
  @Column({ type: 'enum', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

⚠️ **Quan trọng**:

- Property dùng `camelCase`
- Database column dùng `snake_case` (trong `name` option)

---

## Tạo DTO

```typescript
// src/modules/[name]/dto/create-[name].dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateExampleDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

// DTO cho query params
export class GetExamplesDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
```

---

## Tạo Service

```typescript
// src/modules/[name]/[name].service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExampleEntity } from '../../database/entities/example.entity';
import { CreateExampleDto, GetExamplesDto } from './dto';

@Injectable()
export class ExamplesService {
  constructor(
    @InjectRepository(ExampleEntity)
    private readonly repo: Repository<ExampleEntity>,
  ) {}

  // CREATE
  async create(dto: CreateExampleDto, userId: string) {
    const entity = this.repo.create({
      ...dto,
      userId,
    });
    return this.repo.save(entity);
  }

  // READ - với pagination
  async findAll(query: GetExamplesDto) {
    const { page = 1, limit = 20 } = query;

    const queryBuilder = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filter by date
    if (query.dateFrom) {
      queryBuilder.andWhere('e.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // READ ONE
  async findOne(id: string) {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!entity) {
      throw new NotFoundException(`Example with ID ${id} not found`);
    }
    return entity;
  }

  // UPDATE
  async update(id: string, dto: Partial<CreateExampleDto>) {
    await this.findOne(id); // Check exists
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  // DELETE
  async remove(id: string) {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
    return { message: 'Deleted successfully' };
  }
}
```

---

## Tạo Controller

```typescript
// src/modules/[name]/[name].controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExamplesService } from './examples.service';
import { CreateExampleDto, GetExamplesDto } from './dto';

@Controller('examples')
export class ExamplesController {
  constructor(private readonly service: ExamplesService) {}

  @Get()
  findAll(@Query() query: GetExamplesDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateExampleDto) {
    // TODO: Get userId from JWT
    const userId = 'temp-user-id';
    return this.service.create(dto, userId);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateExampleDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
```

---

## Tạo Module

```typescript
// src/modules/[name]/[name].module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExampleEntity } from '../../database/entities/example.entity';
import { ExamplesController } from './examples.controller';
import { ExamplesService } from './examples.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExampleEntity])],
  controllers: [ExamplesController],
  providers: [ExamplesService],
  exports: [ExamplesService], // Export nếu module khác cần dùng
})
export class ExamplesModule {}
```

### Register trong AppModule

```typescript
// src/app.module.ts
import { ExamplesModule } from './modules/examples/examples.module';

@Module({
  imports: [
    // ... other modules
    ExamplesModule, // <-- Thêm vào đây
  ],
})
export class AppModule {}
```

---

## Query Patterns thường dùng

### Filter với JSONB

```typescript
// PostgreSQL JSONB query
queryBuilder.andWhere(`e.metadata->>'category' = :category`, { category: 'tech' });

// Nested JSONB
queryBuilder.andWhere(`e.data->'settings'->>'theme' = :theme`, { theme: 'dark' });
```

### Search text

```typescript
if (query.search) {
  queryBuilder.andWhere('(e.name ILIKE :search OR e.description ILIKE :search)', {
    search: `%${query.search}%`,
  });
}
```

### Filter by relation

```typescript
queryBuilder.leftJoinAndSelect('e.user', 'user').andWhere('user.role = :role', { role: 'ADMIN' });
```

---

## Error Handling

```typescript
// Các exceptions thường dùng
throw new NotFoundException('Resource not found');
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Not authenticated');
throw new ForbiddenException('Not allowed');
throw new ConflictException('Already exists');
```

---

## 📝 Sử dụng Audit Log

Audit Log giúp ghi lại tất cả hoạt động trong hệ thống để theo dõi và bảo mật.

### Bước 1: Import và Inject Service

```typescript
// Trong module của bạn, import AuditLogsModule
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    // ... other imports
    AuditLogsModule, // <-- Thêm vào đây
  ],
})
export class YourModule {}
```

```typescript
// Trong service của bạn
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class YourService {
  constructor(private readonly auditLogsService: AuditLogsService) {}
}
```

### Bước 2: Sử dụng Helper Methods

#### Log CREATE action

```typescript
async createProject(dto: CreateProjectDto, req: any) {
  const project = await this.projectRepo.save(dto);

  // Ghi audit log
  await this.auditLogsService.logCreate(
    'Project',           // entityType
    project.id,          // entityId
    project,             // newData
    req,                 // request object (để lấy IP, user)
  );

  return project;
}
```

#### Log UPDATE action

```typescript
async updateProject(id: string, dto: UpdateProjectDto, req: any) {
  const oldProject = await this.projectRepo.findOne({ where: { id } });
  const newProject = await this.projectRepo.save({ ...oldProject, ...dto });

  // Ghi audit log với data cũ và mới
  await this.auditLogsService.logUpdate(
    'Project',           // entityType
    id,                  // entityId
    oldProject,          // oldData
    newProject,          // newData
    req,                 // request
  );

  return newProject;
}
```

#### Log DELETE action

```typescript
async deleteProject(id: string, req: any) {
  const project = await this.projectRepo.findOne({ where: { id } });
  await this.projectRepo.remove(project);

  // Ghi audit log
  await this.auditLogsService.logDelete(
    'Project',           // entityType
    id,                  // entityId
    project,             // deletedData
    req,                 // request
  );

  return { success: true };
}
```

#### Log VIEW action (cho sensitive data)

```typescript
async getProjectDetails(id: string, req: any) {
  const project = await this.projectRepo.findOne({ where: { id } });

  // Ghi log khi xem dữ liệu nhạy cảm
  await this.auditLogsService.logView('Project', id, req);

  return project;
}
```

#### Log LOGIN/LOGOUT

```typescript
// Trong AuthService
async login(credentials: LoginDto, req: any) {
  const user = await this.validateUser(credentials);
  const tokens = await this.generateTokens(user);

  await this.auditLogsService.logLogin(
    user.id,
    { success: true, method: 'email' },
    req,
  );

  return tokens;
}

async logout(userId: string, req: any) {
  await this.auditLogsService.logLogout(userId, req);
  return { success: true };
}
```

#### Log Custom Action

```typescript
// Cho các action tùy chỉnh
await this.auditLogsService.logCustom(
  'APPROVE', // action name
  'Project', // entityType
  projectId, // entityId
  { status: 'approved', approvedBy: userId }, // data
  req, // request
);
```

### Bước 3: Sử dụng Core Method (Full Control)

```typescript
// Khi cần control hoàn toàn
await this.auditLogsService.log({
  actorId: userId,
  action: 'CUSTOM_ACTION',
  entityType: 'Project',
  entityId: projectId,
  oldData: previousState,
  newData: currentState,
  req: request,
});
```

### Risk Level Tự Động

| Action Type                              | Risk Level |
| ---------------------------------------- | ---------- |
| VIEW, EXPORT, LIST, GET, SEARCH          | LOW        |
| CREATE, UPDATE, EDIT, UPLOAD, APPROVE    | NORMAL     |
| DELETE, LOGIN, CHANGE_PASSWORD, WITHDRAW | HIGH       |

> ⚠️ Nếu phát hiện suspicious activity (IP mới, bot UA), risk sẽ tự động nâng lên HIGH.

### Security Flags Tự Động

- `SUSPICIOUS_USER_AGENT`: UA chứa postman, curl, bot, etc.
- `UNUSUAL_LOCATION`: IP mới trên sensitive actions

---

## 🔐 Authentication & Authorization

Hệ thống auth đã được setup với JWT tokens, role-based access control, và multi-device session management.

### User Roles

```typescript
enum UserRole {
  ADMIN = 'ADMIN',        // System administrators
  STAFF = 'STAFF',        // Platform staff members  
  BROKER = 'BROKER',      // Service brokers/intermediaries
  CLIENT = 'CLIENT',      // Service consumers
  FREELANCER = 'FREELANCER' // Service providers
}
```

#### Self-Registration Restrictions
- ✅ **CLIENT, BROKER, FREELANCER** - Có thể tự đăng ký
- ❌ **ADMIN, STAFF** - Chỉ admin có thể assign

### Authentication Endpoints

```bash
POST /auth/register      # Đăng ký tài khoản mới
POST /auth/login         # Đăng nhập 
POST /auth/logout        # Đăng xuất (cần JWT)
POST /auth/refresh       # Refresh access token
POST /auth/profile       # Lấy thông tin user (cần JWT)
```

### Bảo vệ Routes với Guards

#### 1. JWT Authentication (Yêu cầu login)

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';

@Controller('protected')
export class ProtectedController {
  // Route cần đăng nhập
  @UseGuards(JwtAuthGuard)
  @Get('user-info')
  getUserInfo(@Req() req: AuthRequest) {
    return { message: `Hello ${req.user.email}` };
  }
}
```

#### 2. Role-based Authorization

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('admin')
export class AdminController {
  // Chỉ ADMIN mới access được
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('dashboard')
  getAdminDashboard() {
    return { data: 'Admin only data' };
  }

  // Nhiều roles được phép
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post('moderate')
  moderateContent() {
    return { message: 'Content moderated' };
  }

  // Broker và Admin
  @UseGuards(JwtAuthGuard, RolesGuard)  
  @Roles(UserRole.BROKER, UserRole.ADMIN)
  @Get('broker-tools')
  getBrokerTools() {
    return { tools: [] };
  }
}
```

### Tạo Roles Decorator

```typescript
// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../database/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### Lấy thông tin User trong Controller

```typescript
import { Req } from '@nestjs/common';
import { Request } from 'express';
import { UserEntity } from '../../database/entities/user.entity';

// Extend Request interface
interface AuthRequest extends Request {
  user: UserEntity;
}

@Controller('projects')
export class ProjectsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  createProject(@Body() dto: CreateProjectDto, @Req() req: AuthRequest) {
    const userId = req.user.id;           // User ID
    const userRole = req.user.role;       // User role
    const userEmail = req.user.email;     // User email
    
    return this.projectsService.create(dto, userId);
  }

  // Hoặc tạo custom decorator để lấy user
  @UseGuards(JwtAuthGuard)
  @Get('my-projects')
  getMyProjects(@GetUser() user: UserEntity) {
    return this.projectsService.findByUser(user.id);
  }
}
```

### Tạo GetUser Decorator

```typescript
// src/modules/auth/decorators/get-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../../database/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Sử dụng
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@GetUser() user: UserEntity) {
  return { id: user.id, email: user.email, role: user.role };
}
```

### Multi-Device Session Management

Hệ thống hỗ trợ login đồng thời trên nhiều thiết bị:

```typescript
// Login sẽ track device thông qua User-Agent và IP
// Chỉ logout session cùng thiết bị, không ảnh hưởng device khác
// Tự động giới hạn 5 sessions active per user
```

### Security Best Practices

#### 1. Guard Order quan trọng

```typescript
// ✅ Đúng: JwtAuthGuard trước, RolesGuard sau
@UseGuards(JwtAuthGuard, RolesGuard)

// ❌ Sai: Thiếu JwtAuthGuard sẽ có lỗi
@UseGuards(RolesGuard) // user sẽ undefined
```

#### 2. Error Handling

```typescript
// Tự động throw các exceptions phù hợp
// 401 Unauthorized: Chưa login hoặc token hết hạn  
// 403 Forbidden: Không có quyền truy cập role
```

#### 3. JWT Token Configuration

```bash
# .env configuration
JWT_SECRET=your-super-secure-secret-minimum-32-characters
JWT_EXPIRATION=15m                    # Short-lived access token
JWT_REFRESH_SECRET=another-secret
JWT_REFRESH_EXPIRATION=7d            # Long-lived refresh token
```

### Testing Auth APIs

```bash
# 1. Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "Nguyễn Văn A", 
    "phoneNumber": "0987654321",
    "role": "CLIENT"
  }'

# 2. Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# 3. Access protected route
curl -X GET http://localhost:3001/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Refresh token
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

### Common Patterns

#### Service with User Context

```typescript
@Injectable()
export class ProjectsService {
  // Method có user context
  async findMyProjects(userId: string) {
    return this.projectRepo.find({ 
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  // Method có role-based logic
  async findProjects(user: UserEntity, query: any) {
    const qb = this.projectRepo.createQueryBuilder('p');
    
    // Regular users chỉ thấy projects của mình
    if (user.role === UserRole.CLIENT || user.role === UserRole.FREELANCER) {
      qb.andWhere('p.userId = :userId', { userId: user.id });
    }
    
    // Admin/Staff thấy tất cả
    if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
      // No additional filter
    }
    
    return qb.getMany();
  }
}
```

#### Conditional Guards

```typescript
// Optional authentication (user có thể null)
@UseGuards(OptionalJwtAuthGuard)
@Get('public-with-user-context') 
getPublicContent(@GetUser() user?: UserEntity) {
  if (user) {
    return { message: `Hello ${user.email}`, personalized: true };
  }
  return { message: 'Hello guest', personalized: false };
}
```

---

## Checklist khi tạo module mới

- [ ] Entity tạo đúng format
- [ ] Migration generate và test
- [ ] DTOs với validation decorators
- [ ] Service với CRUD methods
- [ ] Controller với proper decorators
- [ ] **Thêm Guards cho protected routes (@UseGuards(JwtAuthGuard))**
- [ ] **Implement role-based authorization nếu cần**
- [ ] **Tạo decorators và interfaces cho user context**
- [ ] Module registered trong AppModule
- [ ] **Thêm Audit Log cho các actions quan trọng**
- [ ] Test API với Postman (bao gồm cả auth flow)
- [ ] **Test với các roles khác nhau**

---

_Tài liệu được tạo: 2024-12-18_
