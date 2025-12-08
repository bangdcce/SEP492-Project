# Components

Thư mục chứa các React components.

## Cấu trúc

### `/common`
Reusable components được sử dụng ở nhiều nơi:
- `Button/` - Custom button component
- `Input/` - Form input components
- `Modal/` - Modal dialogs
- `Card/` - Card container
- `Loading/` - Loading spinners
- `ErrorBoundary/` - Error handling

### `/layout`
Layout components:
- `Header/` - Header/navbar
- `Footer/` - Footer
- `Sidebar/` - Sidebar navigation
- `MainLayout/` - Main layout wrapper

## Component Structure

Mỗi component nên có cấu trúc:
```
ComponentName/
  index.tsx          # Main component
  ComponentName.tsx  # Component logic (optional)
  styles.module.css  # Component styles
  types.ts           # TypeScript types
  README.md          # Component documentation
```

## Best Practices

1. Mỗi component trong folder riêng
2. Export qua `index.tsx`
3. Sử dụng TypeScript interfaces
4. CSS Modules hoặc styled-components
5. Viết tests cho mỗi component
