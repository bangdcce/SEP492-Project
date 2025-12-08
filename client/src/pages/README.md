# Pages

Thư mục chứa các page components (route-level components).

## Cấu trúc

Mỗi page tương ứng với một route:

```
pages/
  Home/
    index.tsx
    HomePage.tsx
  Auth/
    Login.tsx
    Register.tsx
  Dashboard/
    index.tsx
  NotFound/
    index.tsx
```

## Pages vs Components

- **Pages**: Route-level components, kết nối với routing
- **Components**: Reusable UI pieces, không biết về routing

## Example

```tsx
// pages/Home/index.tsx
import { HomePage } from './HomePage';
export default HomePage;

// App routing
<Route path="/" element={<HomePage />} />
```
