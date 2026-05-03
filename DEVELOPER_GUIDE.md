client/.env
# API Configuration
VITE_API_URL=https://localhost:3000

# Supabase Configuration (Client-side)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
VITE_APP_NAME=InterDev
VITE_APP_VERSION=1.0.0

# Environment
VITE_ENV=development

# Google reCAPTCHA
# Get your site key from: https://www.google.com/recaptcha/admin
VITE_RECAPTCHA_SITE_KEY=6Le-CT8sAAAAAAnM6SyyXz7Wy1NK8IXJ3wRtQj3Z

server/.env
# ==============================================
# APPLICATION CONFIGURATION
# ==============================================
NODE_ENV=development
APP_ENV=development
APP_NAME=InterDev
APP_PORT=3000
APP_URL=https://your-domain.com

# ==============================================
# DATABASE CONFIGURATION
# ==============================================
# Using Supabase PostgreSQL
DB_HOST=aws-1-ap-south-1.pooler.supabase.com
DB_PORT=6543
DB_USERNAME=postgres.rssrcxsuygjzmqmdvgae
DB_PASSWORD=phucand3pzai
DB_DATABASE=postgres
DB_SYNCHRONIZE=false
DB_LOGGING=false
DB_POOL_MAX=4
DB_POOL_IDLE_MS=10000
DB_POOL_CONN_TIMEOUT_MS=5000
DB_POOL_MAX_USES=5000
DB_POOL_ALLOW_EXIT_ON_IDLE=true
DB_QUERY_TIMEOUT_MS=30000
DB_STATEMENT_TIMEOUT_MS=30000

# ==============================================
# BACKGROUND JOBS CONFIGURATION
# ==============================================
HEARING_REMINDER_CRON_ENABLED=false
HEARING_AUTO_START_ENABLED=false
DISPUTE_MEDIATION_TIMEOUT_CRON_ENABLED=false
DISPUTE_TEST_MODE=true

# ==============================================
# SUPABASE STORAGE CONFIGURATIONyar
# ==============================================
# Get these from: Supabase Dashboard > Settings > API
SUPABASE_URL=https://rssrcxsuygjzmqmdvgae.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzc3JjeHN1eWdqem1xbWR2Z2FlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ2NzcxMiwiZXhwIjoyMDgwMDQzNzEyfQ.LoCV-YOYy0mVPHsm_ZV6DL4ZC2STMh9VzGSs-k2YwtI

# ==============================================
# REDIS CONFIGURATION
# ==============================================
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# ==============================================
# JWT CONFIGURATION
# ==============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRATION=7d

# ==============================================
# CORS CONFIGURATION
# ==============================================
CORS_ORIGIN=https://localhost:5173
CORS_CREDENTIALS=true
AUTH_COOKIE_SAME_SITE=none
# ==============================================
# API DOCUMENTATION
# ==============================================
SWAGGER_ENABLED=true
SWAGGER_PATH=/api-docs

# ==============================================
# EMAIL CONFIGURATION
# ==============================================
# Gmail SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=bao20048888@gmail.com
SMTP_PASS=hrcl zwhl lfzv pcll
FROM_EMAIL=InterDev <bao20048888@gmail.com>
FROM_NAME=InterDev Platform

# Frontend URL for reset links
CLIENT_URL=https://localhost:5173

# ==============================================
# GOOGLE OAUTH 2.0 CONFIGURATION
# ==============================================
# Get credentials from: https://console.cloud.google.com/apis/credentials
# See GOOGLE_OAUTH_SETUP.md for detailed setup instructions

GOOGLE_CLIENT_ID=903396358158-358osb8l52clc04pvvbd8jehgkgmrgtf.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
FRONTEND_URL=https://localhost:5173

# ==============================================
# HUNTER.IO EMAIL VERIFICATION
# ==============================================
HUNTER_API_KEY=your_api_key_here
HUNTER_ENABLED=false

# ==============================================
# GOOGLE reCAPTCHA CONFIGURATION
# ==============================================
# Get your keys from: https://www.google.com/recaptcha/admin
# Enable/disable reCAPTCHA for registration (true/false)
RECAPTCHA_ENABLED=true
# reCAPTCHA Site Key (for frontend)
RECAPTCHA_SITE_KEY=6Le-CT8sAAAAAAnM6SyyXz7Wy1NK8IXJ3wRtQj3Z
# reCAPTCHA Secret Key (for backend verification)
RECAPTCHA_SECRET_KEY=6Le-CT8sAAAAAM2hK8hY3LGTyRFu-AwUZ1-X2xlA

ADMIN_EMAIL=admin33@interdev.local
ADMIN_SEED_SECRET=my-secret-key-123


VIRUSTOTAL_API_KEY=f44c35292ad7d00d2204fff082f994646523cdd6961e01ca7282bff3119a0ce3
VIRUSTOTAL_API_URL=https://www.virustotal.com/api/v3
GITHUB_API_TOKEN=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
KYC_ENCRYPTION_KEY=O4rrorJXagy22WarsqZiYnUcf7+PbUfyymd47beQHPQ=
DOCUMENT_HASH_SALT=U28osZVuQ/LOmTIF69JDJKqmYUS3Q6OEJECMBGvxGyQ=
FPT_AI_ENABLED=true
FPT_AI_API_KEY=pvm5MyDXUKKJ1DSMFNfb8pNJ5D1W5o2o
FPT_AI_API_URL=https://api.fpt.ai/vision/idr/vnm

# AI Confidence Thresholds (0-1 scale)
FPT_AI_AUTO_APPROVE_THRESHOLD=0.80
FPT_AI_ADMIN_REVIEW_THRESHOLD=0.55

# ==============================================
# AI MATCHING ENGINE
# ==============================================
GEMINI_API_KEY=AIzaSyCZtTSiUV4ac-PFRyJgXf8WPEelLcwzuk4
GROQ_API_KEY=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
GEMINI_MODEL=gemini-3.1-flash-lite-preview
MATCHING_AI_ENABLED=true
MATCHING_AI_TOP_N=3


# PayPal Sandbox checkout for milestone funding.
# Use `sb` for the generic sandbox shortcut or paste your own sandbox app client id.
PAYPAL_CLIENT_ID=AVnRDLNXQGrmlANBmzi2NQV_U8lBfLAL4KzEDcfWqK3HdxQhgXWNdBtKTrlkJ2LAUfuH5HwSOOEWgc-e
PAYPAL_CLIENT_SECRET=EJqL_8wjfUAwXUXkyQVCev2ScF9v-bUzZ5lP1GCPOcPx62HuvIvU4hizqzZBZ9Ro0oo0QqBUlsFebKYN

# InterDev Developer Guide 📘

Tài liệu hướng dẫn chi tiết cho developer mới tham gia dự án InterDev.

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cài đặt môi trường](#2-cài-đặt-môi-trường)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Quy tắc đặt tên](#4-quy-tắc-đặt-tên)
5. [Database & Migration](#5-database--migration)
6. [Hướng dẫn tạo module mới](#6-hướng-dẫn-tạo-module-mới)
7. [Testing](#7-testing)
8. [Best Practices](#8-best-practices)

---

## 1. Tổng quan dự án

### Tech Stack

| Layer        | Technology                             |
| ------------ | -------------------------------------- |
| **Backend**  | NestJS, TypeORM, PostgreSQL (Supabase) |
| **Frontend** | React, Vite, TypeScript, TailwindCSS   |
| **Auth**     | JWT (Access + Refresh Token)           |
| **Database** | PostgreSQL via Supabase                |

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│  Supabase   │
│  (React)    │◀────│  (NestJS)   │◀────│ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
     :5173              :3000
```

---

## 2. Cài đặt môi trường

### Prerequisites

- Node.js >= 18.x
- Yarn 1.x hoặc npm
- Git
- VS Code (khuyến nghị)

### Cài đặt

```bash
# Clone repo
git clone <repository-url>
cd InterDev

# Install dependencies
cd server && yarn install
cd ../client && yarn install

# Setup environment variables
cp server/.env.example server/.env
# Điền thông tin Supabase vào .env
```

### Chạy development

```bash
# Terminal 1: Backend
cd server
yarn start:dev

# Terminal 2: Frontend
cd client
yarn dev
```

### URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

---

## 3. Cấu trúc thư mục

### Backend (`/server`)

```
server/
├── src/
│   ├── app.module.ts           # Root module
│   ├── main.ts                 # Entry point, CORS config
│   │
│   ├── database/
│   │   ├── entities/           # TypeORM entities (tables)
│   │   │   ├── user.entity.ts
│   │   │   ├── audit-log.entity.ts
│   │   │   └── ...
│   │   ├── migrations/         # Database migrations
│   │   └── seeds/              # Seed data SQL files
│   │
│   ├── modules/                # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   └── dto/            # Data Transfer Objects
│   │   │
│   │   ├── audit-logs/
│   │   │   ├── audit-logs.controller.ts
│   │   │   ├── audit-logs.service.ts
│   │   │   ├── audit-logs.module.ts
│   │   │   └── dto/
│   │   │       ├── get-audit-logs.dto.ts
│   │   │       └── audit-log-response.dto.ts
│   │   └── ...
│   │
│   ├── common/                 # Shared utilities
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── filters/
│   │
│   └── config/                 # Configuration
│
├── data-source.ts              # TypeORM datasource config
├── package.json
└── tsconfig.json
```

### Frontend (`/client`)

```
client/
├── public/
│   └── assets/                 # Static assets (images, fonts)
│
├── src/
│   ├── App.tsx                 # Main app component, routing
│   ├── main.tsx                # Entry point
│   ├── index.css               # Global styles
│   │
│   ├── pages/                  # Page components (route endpoints)
│   │   ├── DashboardPage.tsx
│   │   ├── AuditLogsPage.tsx
│   │   └── ...
│   │
│   ├── features/               # Feature-based modules
│   │   ├── audit-logs/
│   │   │   ├── AuditLogPage.tsx      # Main feature component
│   │   │   ├── api.ts                # API calls
│   │   │   ├── types.ts              # TypeScript types
│   │   │   └── components/           # Feature-specific components
│   │   │       ├── AuditLogTable.tsx
│   │   │       └── AuditLogDetailModal.tsx
│   │   └── ...
│   │
│   ├── shared/                 # Shared across features
│   │   ├── api/
│   │   │   └── client.ts       # Axios instance
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── custom/         # Custom reusable components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── Logo.tsx
│   │   │   └── layouts/        # Layout components
│   │   │       ├── DashboardLayout.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       ├── Header.tsx
│   │   │       └── sidebarConfig.ts
│   │   └── utils/
│   │
│   ├── constants/              # App constants
│   │   └── index.ts            # Routes, API config, etc.
│   │
│   └── lib/                    # Utility functions
│       └── utils.ts            # cn() function for classnames
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 4. Quy tắc đặt tên

### Files & Folders

| Type       | Convention                 | Example                    |
| ---------- | -------------------------- | -------------------------- |
| Entity     | `kebab-case.entity.ts`     | `audit-log.entity.ts`      |
| Controller | `kebab-case.controller.ts` | `audit-logs.controller.ts` |
| Service    | `kebab-case.service.ts`    | `audit-logs.service.ts`    |
| Module     | `kebab-case.module.ts`     | `audit-logs.module.ts`     |
| DTO        | `kebab-case.dto.ts`        | `get-audit-logs.dto.ts`    |
| Component  | `PascalCase.tsx`           | `AuditLogTable.tsx`        |
| Hook       | `use-camelCase.ts`         | `use-auth.ts`              |
| Type file  | `types.ts`                 | `types.ts`                 |
| API file   | `api.ts`                   | `api.ts`                   |

### Code Naming

```typescript
// Classes: PascalCase
class AuditLogsService {}
class GetAuditLogsDto {}

// Interfaces/Types: PascalCase
interface AuditLogEntry {}
type RiskLevel = 'LOW' | 'NORMAL' | 'HIGH';

// Functions/Methods: camelCase
function getAuditLogs() {}
const handleSubmit = () => {};

// Variables: camelCase
const auditLogs = [];
let currentPage = 1;

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = 'http://localhost:3000';
const MAX_RETRY_COUNT = 3;

// Database columns: snake_case (trong entity dùng name option)
@Column({ name: 'actor_id' })
actorId: string;
```

---

## 5. Database & Migration

### Entity Conventions

```typescript
// server/src/database/entities/example.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("examples") // Table name: plural, snake_case
export class ExampleEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" }) // DB column: snake_case
  userId: string; // Property: camelCase

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
```

### Migration Commands

```bash
cd server

# Generate migration từ entity changes
yarn migration:generate src/database/migrations/MigrationName

# Chạy pending migrations
yarn build
yarn typeorm migration:run -d dist/data-source.js

# Revert migration cuối
yarn typeorm migration:revert -d dist/data-source.js

# Xem trạng thái migrations
yarn typeorm migration:show -d dist/data-source.js
```

### Migration Best Practices

1. **Luôn backup trước khi migrate production**
2. **Tên migration có ý nghĩa**: `AddUserRoleColumn`, `CreateAuditLogsTable`
3. **Không sửa migration đã chạy** - tạo migration mới
4. **Test migration trên local trước**

### Reset Database (Development)

```sql
-- Chạy trong Supabase SQL Editor
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Sau đó:

```bash
yarn build
yarn typeorm migration:run -d dist/data-source.js
```

---

## 6. Hướng dẫn tạo module mới

### Backend: Tạo module NestJS

#### Bước 1: Tạo Entity

```typescript
// server/src/database/entities/project.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("projects")
export class ProjectEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
```

#### Bước 2: Generate Migration

```bash
yarn migration:generate src/database/migrations/CreateProjectsTable
yarn build
yarn typeorm migration:run -d dist/data-source.js
```

#### Bước 3: Tạo DTOs

```typescript
// server/src/modules/projects/dto/create-project.dto.ts
import { IsString, IsOptional, MaxLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

#### Bước 4: Tạo Service

```typescript
// server/src/modules/projects/projects.service.ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProjectEntity } from "../../database/entities/project.entity";
import { CreateProjectDto } from "./dto/create-project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>
  ) {}

  async create(dto: CreateProjectDto, userId: string) {
    const project = this.projectRepo.create({
      ...dto,
      ownerId: userId,
    });
    return this.projectRepo.save(project);
  }

  async findAll() {
    return this.projectRepo.find({
      order: { createdAt: "DESC" },
    });
  }
}
```

#### Bước 5: Tạo Controller

```typescript
// server/src/modules/projects/projects.controller.ts
import { Controller, Get, Post, Body } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    // TODO: Get userId from JWT
    return this.projectsService.create(dto, "temp-user-id");
  }
}
```

#### Bước 6: Tạo Module và Register

```typescript
// server/src/modules/projects/projects.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProjectEntity } from "../../database/entities/project.entity";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

```typescript
// server/src/app.module.ts - Thêm vào imports
import { ProjectsModule } from "./modules/projects/projects.module";

@Module({
  imports: [
    // ... existing imports
    ProjectsModule,
  ],
})
export class AppModule {}
```

---

### Frontend: Tạo Feature mới

#### Bước 1: Tạo feature folder structure

```
client/src/features/projects/
├── ProjectsPage.tsx          # Main feature component
├── api.ts                    # API calls
├── types.ts                  # TypeScript types
└── components/
    ├── ProjectCard.tsx
    └── ProjectForm.tsx
```

#### Bước 2: Define Types

```typescript
// client/src/features/projects/types.ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}
```

#### Bước 3: Create API Service

```typescript
// client/src/features/projects/api.ts
import { apiClient } from "@/shared/api/client";
import type { Project, CreateProjectInput } from "./types";

const ENDPOINTS = {
  PROJECTS: "/projects",
};

export const projectsApi = {
  getAll: () => apiClient.get<Project[]>(ENDPOINTS.PROJECTS),

  create: (data: CreateProjectInput) =>
    apiClient.post<Project>(ENDPOINTS.PROJECTS, data),

  getById: (id: string) =>
    apiClient.get<Project>(`${ENDPOINTS.PROJECTS}/${id}`),
};
```

#### Bước 4: Create Components

```tsx
// client/src/features/projects/ProjectsPage.tsx
import React, { useState, useEffect } from "react";
import { projectsApi } from "./api";
import type { Project } from "./types";

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectsApi.getAll();
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projects</h1>
      {/* Render projects */}
    </div>
  );
};
```

#### Bước 5: Create Page wrapper

```tsx
// client/src/pages/ProjectsPage.tsx
import { ProjectsPage } from "@/features/projects/ProjectsPage";

export default function ProjectsPageWrapper() {
  return <ProjectsPage />;
}
```

#### Bước 6: Add Route

```tsx
// client/src/App.tsx
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));

// In Routes:
<Route
  path="/projects"
  element={
    <MainLayout>
      <ProjectsPage />
    </MainLayout>
  }
/>;
```

---

## 7. Testing

### Backend Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Coverage
yarn test:cov
```

### Frontend Testing

```bash
# Run tests
yarn test

# Watch mode
yarn test --watch
```

---

## 8. Best Practices

### Backend

1. **Validate all inputs** với `class-validator`
2. **Use DTOs** cho request/response
3. **Handle errors** với exception filters
4. **Log important actions** với audit logging
5. **Never expose passwords** trong responses

### Frontend

1. **Use TypeScript strictly** - no `any` unless necessary
2. **Separate concerns** - components, API, types
3. **Handle loading & error states**
4. **Use `useCallback` & `useMemo`** for performance
5. **Keep components small** - extract shared logic

### Git Workflow

```bash
# Feature branch
git checkout -b feature/add-projects-module

# Commit messages (conventional commits)
git commit -m "feat(projects): add projects module"
git commit -m "fix(auth): resolve token refresh issue"
git commit -m "docs: update README"

# Push and create PR
git push origin feature/add-projects-module
```

---

## Checklist khi tạo feature mới

### Backend

- [ ] Entity với đúng naming convention
- [ ] Migration được generate và test
- [ ] DTOs với validation
- [ ] Service với business logic
- [ ] Controller với proper decorators
- [ ] Module được register trong AppModule
- [ ] API tested với Postman/Insomnia

### Frontend

- [ ] Types định nghĩa đầy đủ
- [ ] API service functions
- [ ] Feature component với loading/error states
- [ ] Page wrapper trong `/pages`
- [ ] Route added trong App.tsx
- [ ] Sidebar entry (nếu cần)
- [ ] Responsive design

---

## Liên hệ & Support

- **Project Lead**: [Name]
- **Technical Lead**: [Name]
- **Documentation**: Cập nhật khi có thay đổi

---

_Tài liệu được tạo: 2024-12-18_
