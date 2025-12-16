import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "@/shared/components/ui";
import { useAuth } from "@/features/auth";
import { ROUTES } from "@/constants";
import { isValidEmail } from "@/shared/utils";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(email)) {
      setError("Email không hợp lệ");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setIsLoading(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError("Email hoặc mật khẩu không đúng");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Mật khẩu"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="rounded border-input" />
          <span className="text-muted-foreground">Ghi nhớ đăng nhập</span>
        </label>
        <Link to="/forgot-password" className="text-primary hover:underline">
          Quên mật khẩu?
        </Link>
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Đăng nhập
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link to={ROUTES.REGISTER} className="text-primary hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
}
