# Hướng dẫn implement Dashboard cho Freelancer và Broker

## 📋 Tổng quan

Infrastructure cho role-based routing đã được setup sẵn. Đồng đội chỉ cần tạo components và gắn vào routes có sẵn.

## 🎯 Đã có sẵn (Infrastructure)

### 1. Routes Constants (`client/src/constants/index.ts`)
```typescript
FREELANCER_DASHBOARD: "/freelancer/dashboard"
FREELANCER_PROFILE: "/freelancer/profile"
BROKER_DASHBOARD: "/broker/dashboard"
BROKER_PROFILE: "/broker/profile"
```

### 2. Login Role Logic (`client/src/pages/SignInPage.tsx`)
```typescript
if (userRole === 'FREELANCER') {
  navigate(ROUTES.FREELANCER_DASHBOARD);
} else if (userRole === 'BROKER') {
  navigate(ROUTES.BROKER_DASHBOARD);
}
```

### 3. Placeholder Routes (`client/src/App.tsx`)
Routes đã được setup với placeholder components. Chỉ cần thay thế bằng components thật.

## ✅ Cần làm (TODO)

### Option 1: Tạo pages riêng (Recommended)

#### Cho Freelancer:
1. Tạo file `client/src/pages/FreelancerDashboardPage.tsx`
2. Tạo file `client/src/pages/FreelancerProfilePage.tsx`
3. Update `App.tsx`:
```typescript
// Thêm import
const FreelancerDashboardPage = lazy(() => import("@/pages/FreelancerDashboardPage"));
const FreelancerProfilePage = lazy(() => import("@/pages/FreelancerProfilePage"));

// Thay thế route
<Route
  path={ROUTES.FREELANCER_DASHBOARD}
  element={
    <MainLayout>
      <FreelancerDashboardPage />
    </MainLayout>
  }
/>
```

#### Cho Broker:
1. Tạo file `client/src/pages/BrokerDashboardPage.tsx`
2. Tạo file `client/src/pages/BrokerProfilePage.tsx`
3. Update `App.tsx` tương tự

### Option 2: Tạo feature modules (Scalable)

```
client/src/features/
├── freelancer/
│   ├── FreelancerDashboard.tsx
│   ├── FreelancerProfile.tsx
│   └── api.ts
└── broker/
    ├── BrokerDashboard.tsx
    ├── BrokerProfile.tsx
    └── api.ts
```

## 📝 Template Component

```typescript
// FreelancerDashboardPage.tsx
import { useState, useEffect } from 'react';

export default function FreelancerDashboardPage() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Load freelancer data
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Freelancer Dashboard</h1>
      {/* Your content here */}
    </div>
  );
}
```

## 🔐 Role Access Control (Nếu cần)

Nếu muốn bảo vệ routes, tạo guard component:

```typescript
// client/src/shared/components/guards/RoleGuard.tsx
export function RoleGuard({ allowedRoles, children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}

// Sử dụng trong App.tsx
<Route
  path={ROUTES.FREELANCER_DASHBOARD}
  element={
    <RoleGuard allowedRoles={['FREELANCER']}>
      <MainLayout>
        <FreelancerDashboardPage />
      </MainLayout>
    </RoleGuard>
  }
/>
```

## 🎨 Layout Options

Có thể tái sử dụng `MainLayout` hoặc tạo layout riêng:

```typescript
// client/src/shared/components/layouts/FreelancerLayout.tsx
export function FreelancerLayout({ children }) {
  return (
    <div className="freelancer-layout">
      {/* Custom sidebar, header for freelancer */}
      {children}
    </div>
  );
}
```

## 🧪 Testing

Để test role routing:
1. Đăng ký account với role FREELANCER/BROKER trong database
2. Login bằng account đó
3. Sẽ tự động redirect tới dashboard tương ứng

## 📦 Summary

**Đã setup:**
- ✅ Routes constants
- ✅ Login redirect logic dựa trên role
- ✅ Placeholder routes trong App.tsx

**Cần làm:**
- [ ] Tạo FreelancerDashboardPage.tsx
- [ ] Tạo FreelancerProfilePage.tsx
- [ ] Tạo BrokerDashboardPage.tsx
- [ ] Tạo BrokerProfilePage.tsx
- [ ] Thay placeholder components trong App.tsx
- [ ] (Optional) Tạo RoleGuard cho access control
- [ ] (Optional) Tạo custom layouts cho từng role

---

**Liên hệ:** Nếu cần API endpoints mới cho freelancer/broker features, báo backend team tạo.
