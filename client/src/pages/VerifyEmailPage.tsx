import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Mail, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/constants';
import { verifyEmail, resendVerificationEmail } from '@/features/auth/api';
import { Button } from '@/shared/components/custom/Button';
import { Input } from '@/shared/components/custom/input';
import { AuthLayout } from '@/shared/components/layouts/AuthLayout';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const pendingEmail = searchParams.get('email');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired' | 'pending'>('loading');
  const [email, setEmail] = useState<string>('');
  const [resendEmail, setResendEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resending, setResending] = useState(false);
  const lastTokenRef = useRef<string | null>(null);

  const handleVerifyEmail = async () => {
    if (!token) return;

    try {
      setStatus(prevStatus => (prevStatus === 'pending' ? 'pending' : 'loading'));
      const response = await verifyEmail(token);
      setStatus('success');
      setEmail(response.email);
      toast.success('Email verified successfully!');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate(ROUTES.LOGIN);
      }, 3000);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Email verification failed';
      setErrorMessage(errorMsg);

      // Check if token expired
      if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('hết hạn')) {
        setStatus('expired');
      } else {
        setStatus('error');
      }
      toast.error(errorMsg);
    }
  };

  const handleResendEmail = async () => {
    const emailToResend = email || resendEmail;
    if (!emailToResend) {
      toast.error('Please enter email to resend');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToResend)) {
      toast.error('Invalid email');
      return;
    }

    try {
      setResending(true);
      await resendVerificationEmail(emailToResend);
      toast.success('Verification email resent! Please check your inbox.');
      setStatus(prevStatus => (prevStatus === 'pending' ? 'pending' : 'loading'));
      setErrorMessage('');
      setResendEmail('');
    } catch (error: any) {
      console.error('Resend email error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to resend email. Please try again later.';
      toast.error(errorMsg);
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!token) {
      if (pendingEmail) {
        setStatus('pending');
        setResendEmail(pendingEmail);
      } else {
        setStatus('error');
        setErrorMessage('Invalid verification token. Please check the link in your email.');
      }
      return;
    }

    // Verify email on mount (guard against double-invoke in StrictMode)
    if (lastTokenRef.current === token) {
      return;
    }
    lastTokenRef.current = token;
    handleVerifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pendingEmail]);

  return (
    <AuthLayout>
      <div className="flex items-center justify-center min-h-screen py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Loading State */}
            {status === 'loading' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <Loader2 className="w-16 h-16 text-teal-500 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Đang xác thực email...
                </h1>
                <p className="text-gray-600">
                  Vui lòng đợi trong giây lát
                </p>
              </div>
            )}

            {/* Pending Verification State */}
            {status === 'pending' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Mail className="w-12 h-12 text-yellow-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Email verification pending
                </h1>
                <p className="text-gray-600 mb-6">
                  We sent a verification email to <strong>{pendingEmail || resendEmail}</strong>.
                  Please check your inbox and click the verification link.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={handleResendEmail}
                    disabled={resending || (!email && !resendEmail)}
                    className="w-full"
                    style={{
                      backgroundColor: '#14b8a6',
                      color: 'white',
                    }}
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Resend verification email
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => navigate(ROUTES.LOGIN)}
                    variant="outline"
                    className="w-full"
                  >
                    Back to login
                  </Button>
                </div>
              </div>
            )}

            {/* Success State */}
            {status === 'success' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="flex justify-center mb-6"
                >
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                </motion.div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Xác thực thành công!
                </h1>
                <p className="text-gray-600 mb-6">
                  Email <strong>{email}</strong> đã được xác thực thành công.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Bạn sẽ được chuyển đến trang đăng nhập trong giây lát...
                </p>
                <Button
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="w-full"
                  style={{
                    backgroundColor: '#14b8a6',
                    color: 'white',
                  }}
                >
                  Đăng nhập ngay
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Xác thực thất bại
                </h1>
                <p className="text-gray-600 mb-6">
                  {errorMessage || 'Token xác thực không hợp lệ hoặc đã được sử dụng.'}
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate(ROUTES.LOGIN)}
                    className="w-full"
                    style={{
                      backgroundColor: '#14b8a6',
                      color: 'white',
                    }}
                  >
                    Quay lại đăng nhập
                  </Button>
                  <Button
                    onClick={() => navigate(ROUTES.REGISTER)}
                    variant="outline"
                    className="w-full"
                  >
                    Đăng ký lại
                  </Button>
                </div>
              </div>
            )}

            {/* Expired Token State */}
            {status === 'expired' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Mail className="w-12 h-12 text-yellow-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Link đã hết hạn
                </h1>
                <p className="text-gray-600 mb-6">
                  Link xác thực đã hết hạn (sau 24 giờ). Vui lòng nhập email để gửi lại link xác thực.
                </p>
                {!email && (
                  <div className="mb-4 text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Nhập email của bạn"
                    />
                  </div>
                )}
                <div className="space-y-3">
                  <Button
                    onClick={handleResendEmail}
                    disabled={resending || (!email && !resendEmail)}
                    className="w-full"
                    style={{
                      backgroundColor: '#14b8a6',
                      color: 'white',
                    }}
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Gửi lại email xác thực
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => navigate(ROUTES.LOGIN)}
                    variant="outline"
                    className="w-full"
                  >
                    Quay lại đăng nhập
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AuthLayout>
  );
}

export default VerifyEmailPage;

