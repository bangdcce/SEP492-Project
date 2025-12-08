# Common

Thư mục chứa các utilities, helpers, và shared code được sử dụng chung trong toàn bộ ứng dụng.

## Cấu trúc

### `/guards`
Custom guards cho authorization và authentication
- `auth.guard.ts` - Kiểm tra JWT token
- `roles.guard.ts` - Kiểm tra user roles

### `/interceptors`
Interceptors để transform request/response
- `transform.interceptor.ts` - Transform response format
- `logging.interceptor.ts` - Log requests

### `/decorators`
Custom decorators
- `current-user.decorator.ts` - Lấy thông tin user hiện tại
- `roles.decorator.ts` - Định nghĩa roles cho routes

### `/filters`
Exception filters
- `http-exception.filter.ts` - Xử lý HTTP exceptions

### `/pipes`
Validation và transformation pipes
- `validation.pipe.ts` - Validate DTOs

### `/dto`
Shared DTOs được sử dụng ở nhiều modules
- `pagination.dto.ts` - Pagination params

### `/interfaces`
TypeScript interfaces dùng chung
- `response.interface.ts` - API response format
