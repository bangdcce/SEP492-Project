import { AuthLayout } from "@/shared/components/layouts";
import { LoginForm } from "@/features/auth";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại! Vui lòng đăng nhập để tiếp tục."
    >
      <LoginForm />
    </AuthLayout>
  );
}
