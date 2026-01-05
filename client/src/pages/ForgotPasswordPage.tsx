import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../shared/components/layouts/AuthLayout';
import { Input } from '../shared/components/custom/input';
import { Button } from '../shared/components/custom/Button';
import { OTPInput } from '../shared/components/auth/OTPInput';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/constants';
import { forgotPassword, verifyOtp, resetPassword } from '@/features/auth';

export interface ForgotPasswordPageProps {
  onNavigateToSignIn?: () => void;
}

type Step = 'phone' | 'otp' | 'reset';

export function ForgotPasswordPage({ onNavigateToSignIn }: ForgotPasswordPageProps = {}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***${localPart.slice(-1)}@${domain}`;
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await forgotPassword({ email });
      
      setStep('otp');
      setResendCountdown(60);
      toast.success(response.message || `OTP sent to ${maskEmail(email)}`);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      setErrors({ email: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    
    setLoading(true);
    try {
      await forgotPassword({ email });
      setResendCountdown(60);
      toast.success('OTP resent successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to resend OTP';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (otp.length !== 6) {
      newErrors.otp = 'Please enter the 6-digit code';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await verifyOtp({ email, otp });
      
      if (response.data.isValid) {
        setStep('reset');
        toast.success('OTP verified successfully!');
      } else {
        setErrors({ otp: 'Invalid OTP code' });
        toast.error('Invalid OTP code');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const errorMessage = error.response?.data?.message || 'Invalid OTP code';
      setErrors({ otp: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[@$!%*?&]/.test(newPassword)) {
      newErrors.newPassword = 'Password must be at least 8 characters with lowercase, number & special character (@$!%*?&)';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await resetPassword({ 
        email, 
        otp, 
        newPassword,
        confirmPassword
      });
      
      toast.success('Password reset successful. Please sign in.');
      setTimeout(() => {
        if (onNavigateToSignIn) {
          onNavigateToSignIn();
        } else {
          navigate(ROUTES.LOGIN);
        }
      }, 1500);
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to reset password. Please try again.';
      setErrors({ newPassword: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtp('');
      setErrors({});
    } else if (step === 'reset') {
      setStep('otp');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  };

  const renderPhoneStep = () => (
    <form onSubmit={handleSendOTP} className="space-y-6">
      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors({ ...errors, email: '' });
        }}
        error={errors.email}
      />

      <Button 
        type="submit" 
        variant="primary" 
        className="w-full py-3 text-base font-medium justify-center"
        disabled={loading}
      >
        {loading ? 'Sending OTP...' : 'Send OTP'}
      </Button>

      <button
        type="button"
        onClick={() => onNavigateToSignIn ? onNavigateToSignIn() : navigate(ROUTES.LOGIN)}
        className="w-full text-center hover:underline"
        style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem' }}
      >
        Back to Sign In
      </button>
    </form>
  );

  const renderOTPStep = () => (
    <form onSubmit={handleVerifyOTP} className="space-y-6">
      <div>
        <p className="mb-6" style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem' }}>
          Enter the 6-digit code sent to{' '}
          <span style={{ color: 'var(--auth-text)', fontWeight: 500 }}>
            {maskEmail(email)}
          </span>
        </p>

        <div className="flex justify-center mb-4">
          <OTPInput
            value={otp}
            onChange={(value) => {
              setOtp(value);
              if (errors.otp) setErrors({ ...errors, otp: '' });
            }}
            error={!!errors.otp}
          />
        </div>

        {errors.otp && (
          <p className="text-center text-sm mt-2" style={{ color: 'var(--auth-error)' }}>
            {errors.otp}
          </p>
        )}
      </div>

      <div className="text-center">
        {resendCountdown > 0 ? (
          <p style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem' }}>
            Resend code in <span style={{ color: 'var(--auth-primary)', fontWeight: 500 }}>{resendCountdown}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResendOTP}
            className="hover:underline"
            style={{ color: 'var(--auth-primary)', fontSize: '0.875rem', fontWeight: 500 }}
          >
            Resend Code
          </button>
        )}
      </div>

      <Button 
        type="submit" 
        variant="primary" 
        className="w-full py-3 text-base font-medium justify-center"
        disabled={loading}
      >
        {loading ? 'Verifying...' : 'Verify'}
      </Button>

      <button
        type="button"
        onClick={handleBack}
        className="w-full flex items-center justify-center gap-2 hover:underline"
        style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
    </form>
  );

  const renderResetStep = () => (
    <form onSubmit={handleResetPassword} className="space-y-6">
      <div className="relative">
        <Input
          id="newPassword"
          label="New password"
          type={showNewPassword ? 'text' : 'password'}
          placeholder="At least 8 characters with lowercase, number & special char"
          value={newPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setNewPassword(e.target.value);
            if (errors.newPassword) setErrors({ ...errors, newPassword: '' });
          }}
          error={errors.newPassword}
          helperText="Must include: lowercase, number & special character (@$!%*?&)"
        />
        <button
          type="button"
          onClick={() => setShowNewPassword(!showNewPassword)}
          className="absolute right-3 top-11"
          tabIndex={-1}
        >
          {showNewPassword ? (
            <EyeOff className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
          ) : (
            <Eye className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
          )}
        </button>
      </div>

      <div className="relative">
        <Input
          id="confirmPassword"
          label="Confirm password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
          }}
          error={errors.confirmPassword}
          success={!!(confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 8)}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-11"
          tabIndex={-1}
        >
          {showConfirmPassword ? (
            <EyeOff className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
          ) : (
            <Eye className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
          )}
        </button>
      </div>

      <Button 
        type="submit" 
        variant="primary" 
        className="w-full py-3 text-base font-medium justify-center"
        disabled={loading}
      >
        {loading ? 'Resetting password...' : 'Reset Password'}
      </Button>
    </form>
  );

  const getTitleAndSubtitle = () => {
    switch (step) {
      case 'phone':
        return {
          title: 'Forgot Password?',
          subtitle: 'Enter your email to receive a verification code.',
        };
      case 'otp':
        return {
          title: 'Verify Code',
          subtitle: 'Enter the verification code sent to your email.',
        };
      case 'reset':
        return {
          title: 'Reset Password',
          subtitle: 'Create a new password for your account.',
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      {step === 'phone' && renderPhoneStep()}
      {step === 'otp' && renderOTPStep()}
      {step === 'reset' && renderResetStep()}
    </AuthLayout>
  );
}

export default ForgotPasswordPage;