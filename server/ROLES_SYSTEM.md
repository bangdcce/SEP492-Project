# Authentication Role System

## User Roles Overview

The system uses a centralized role enumeration in `UserEntity` to ensure consistency across the application:

```typescript
export enum UserRole {
  ADMIN = 'ADMIN',        // System administrators
  STAFF = 'STAFF',        // Platform staff members  
  BROKER = 'BROKER',      // Service brokers/intermediaries
  CLIENT = 'CLIENT',      // Service consumers
  FREELANCER = 'FREELANCER' // Service providers
}
```

## Registration Role Restrictions

For security reasons, not all roles can be self-registered. The `RegisterDto` uses a subset of `UserRole`:

### Allowed for Self-Registration:
- ✅ **CLIENT** - Service consumers
- ✅ **BROKER** - Service brokers/intermediaries  
- ✅ **FREELANCER** - Service providers

### Restricted Roles (Admin Assignment Only):
- ❌ **ADMIN** - System administrators
- ❌ **STAFF** - Platform staff members

## Implementation Details

```typescript
// Type alias for registerable roles
export type RegisterableRole = UserRole.CLIENT | UserRole.BROKER | UserRole.FREELANCER;

// Validation object for class-validator
export const REGISTERABLE_ROLES = {
  CLIENT: UserRole.CLIENT,
  BROKER: UserRole.BROKER,
  FREELANCER: UserRole.FREELANCER,
} as const;
```

## Benefits of This Approach

1. **Single Source of Truth**: All roles defined in one place
2. **Type Safety**: No need for unsafe type casting
3. **Security**: Admin roles cannot be self-registered
4. **Maintainability**: Adding new roles only requires updating the main enum
5. **Consistency**: Same role values used across authentication and authorization

## Migration from RegisterRole

The previous `RegisterRole` enum has been replaced with `RegisterableRole` type to:
- Eliminate duplication
- Ensure consistency with database schema
- Improve type safety
- Simplify maintenance