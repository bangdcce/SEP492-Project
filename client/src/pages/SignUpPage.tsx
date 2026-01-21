import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '../shared/components/custom/input';
import { Button } from '../shared/components/custom/Button';
// import { GoogleButton } from '../shared/components/auth/GoogleButton';
import { PasswordStrength } from '../shared/components/auth/PasswordStrength';
import { CaptchaInput } from '../shared/components/auth/CaptchaInput';
import { AuthLayout } from '../shared/components/layouts/AuthLayout';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Building2, Store, Briefcase, Laptop } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/constants';
import { signUp } from '@/features/auth';

interface SignUpPageProps {
  onNavigateToSignIn?: () => void;
  onSignUpSuccess?: () => void;
}

type UserRole = 'client_large' | 'client_small' | 'broker' | 'freelancer';

export function SignUpPage({ onNavigateToSignIn, onSignUpSuccess }: SignUpPageProps = {}) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1: Role Selection, 2: Info Form
  const [formData, setFormData] = useState({
    role: '' as UserRole | '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    recaptchaToken: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCorporateEmail = (email: string): boolean => {
    const freeEmailProviders = [
      'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
      'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
      'icloud.com', 'me.com', 'aol.com', 'mail.com',
      'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
      'gmx.com', 'gmx.net', 'inbox.com', 'mail.ru'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return !freeEmailProviders.includes(domain);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    return phoneRegex.test(phone);
  };

  const passwordRequirements = {
    minLength: formData.password.length >= 8,
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[@$!%*?&]/.test(formData.password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Validation
    if (!formData.role) {
      newErrors.role = 'Please select your role';
    }

    if (!formData.fullName) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email address';
    } else if (formData.role === 'client_large' && !validateCorporateEmail(formData.email)) {
      newErrors.email = 'Large SMEs must use a corporate/organization email (not Gmail, Yahoo, Hotmail, etc.)';
    }

    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number. Format: 0[3|5|7|8|9]xxxxxxxx';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isPasswordValid) {
      newErrors.password = 'Password must meet all requirements';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    if (!formData.recaptchaToken) {
      newErrors.recaptcha = 'Please complete the reCAPTCHA verification';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // Map frontend roles to backend roles
      let backendRole;
      if (formData.role === 'client_large') {
        backendRole = 'CLIENT';
      } else if (formData.role === 'client_small') {
        backendRole = 'CLIENT_SME';
      } else {
        backendRole = formData.role.toUpperCase();
      }

      await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        role: backendRole as any,
        recaptchaToken: formData.recaptchaToken,
      });

      toast.success('Account created successfully! Please sign in.');
      
      if (onSignUpSuccess) {
        onSignUpSuccess();
      } else {
        navigate(ROUTES.LOGIN);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle error message (could be string, array, or object)
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        if (typeof msg === 'string') {
          errorMessage = msg;
        } else if (Array.isArray(msg)) {
          errorMessage = msg[0];
        } else if (typeof msg === 'object') {
          errorMessage = JSON.stringify(msg);
        }
      }
      
      // Check if error is related to duplicate email
      if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('email')) {
        setErrors({ email: errorMessage });
      } else if (typeof errorMessage === 'string' && (errorMessage.toLowerCase().includes('captcha') || errorMessage.toLowerCase().includes('recaptcha'))) {
        setErrors({ recaptcha: errorMessage });
      } else {
        setErrors({ agreeToTerms: errorMessage });
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'client_large':
        return 'Business Owner (Large SME)';
      case 'client_small':
        return 'Business Owner (Small SME/Individual)';
      case 'broker':
        return 'Broker (Project Consultant)';
      case 'freelancer':
        return 'Freelancer (Developer)';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'client_large':
        return 'I need software solutions for my established business (requires corporate email)';
      case 'client_small':
        return 'I need software solutions for my small business or personal project';
      case 'broker':
        return 'I help translate business needs into technical requirements';
      case 'freelancer':
        return 'I build software and deliver projects';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'client_large':
        return Building2;
      case 'client_small':
        return Store;
      case 'broker':
        return Briefcase;
      case 'freelancer':
        return Laptop;
    }
  };
const handleRoleSelect = (role: UserRole) => {
    handleChange('role', role);
    // Auto-advance to next step after selecting role
    setTimeout(() => {
      setCurrentStep(2);
    }, 300);
  };

  const handleBackToRoleSelection = () => {
    setCurrentStep(1);
  };

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  const getStepTitle = () => {
    if (currentStep === 1) {
      return 'Choose Your Role';
    }
    return 'Complete Your Profile';
  };

  const getStepSubtitle = () => {
    if (currentStep === 1) {
      return 'Tell us what brings you to our platform';
    }
    return `You're signing up as ${formData.role ? getRoleLabel(formData.role) : 'a user'}`;
  };

  return (
    <AuthLayout 
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
    >
      {/* Progress Indicator */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div 
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: currentStep >= 1 ? 'var(--auth-primary)' : 'var(--auth-border)',
              transition: 'background-color 0.3s ease',
            }}
          />
          <div 
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: currentStep >= 2 ? 'var(--auth-primary)' : 'var(--auth-border)',
              transition: 'background-color 0.3s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--auth-text-muted)' }}>
          <span style={{ fontWeight: currentStep === 1 ? 600 : 400, color: currentStep === 1 ? 'var(--auth-primary)' : 'var(--auth-text-muted)' }}>Step 1: Role</span>
          <span style={{ fontWeight: currentStep === 2 ? 600 : 400, color: currentStep === 2 ? 'var(--auth-primary)' : 'var(--auth-text-muted)' }}>Step 2: Details</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AnimatePresence mode="wait" custom={currentStep}>
          {currentStep === 1 ? (
            <motion.div
              key="step1"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              {/* Role Selection */}
              <div>
                <label 
                  htmlFor="role"
                  style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--auth-text)',
                  }}
                >
                  I am a... <span style={{ color: 'var(--auth-error)' }}>*</span>
                </label>
                <div className="space-y-3">
                  {(['client_large', 'client_small', 'broker', 'freelancer'] as UserRole[]).map((role) => (
                    <motion.button
                      key={role}
                      type="button"
                      onClick={() => handleRoleSelect(role)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: `2px solid ${formData.role === role ? 'var(--auth-primary)' : 'var(--auth-border)'}`,
                        backgroundColor: formData.role === role ? 'rgba(37, 99, 235, 0.05)' : 'var(--auth-input-bg)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (formData.role !== role) {
                          e.currentTarget.style.borderColor = 'var(--auth-primary)';
                          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.role !== role) {
                          e.currentTarget.style.borderColor = 'var(--auth-border)';
                          e.currentTarget.style.backgroundColor = 'var(--auth-input-bg)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            backgroundColor: formData.role === role ? 'var(--auth-primary)' : 'rgba(37, 99, 235, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {React.createElement(getRoleIcon(role), {
                            className: 'w-6 h-6',
                            style: { color: formData.role === role ? 'white' : 'var(--auth-primary)' },
                          })}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--auth-text)', marginBottom: '0.25rem' }}>
                            {getRoleLabel(role)}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--auth-text-muted)' }}>
                            {getRoleDescription(role)}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5" style={{ color: 'var(--auth-text-muted)', opacity: formData.role === role ? 1 : 0.3 }} />
                      </div>
                    </motion.button>
                  ))}
                </div>
                {errors.role && (
                  <p style={{ color: 'var(--auth-error)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {errors.role}
                  </p>
                )}
              </div>

              <p className="text-center" style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem', marginTop: '2rem' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => onNavigateToSignIn ? onNavigateToSignIn() : navigate(ROUTES.LOGIN)}
                  className="hover:underline"
                  style={{ color: 'var(--auth-primary)', fontWeight: 500 }}
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              custom={2}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              {/* Back Button */}
              <button
                type="button"
                onClick={handleBackToRoleSelection}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1.5rem',
                  color: 'var(--auth-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem 0',
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                <ArrowLeft className="w-4 h-4" />
                Change role
              </button>

              <Input
                id="fullName"
                label="Full Name"
                type="text"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('fullName', e.target.value)}
                error={errors.fullName}
                required
              />

              <Input
                id="email"
                label="Email"
                type="email"
                placeholder={formData.role === 'client_large' ? 'company@yourbusiness.com' : 'Enter your email'}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={errors.email}
                helperText={formData.role === 'client_large' ? 'Use your company/university email (e.g., name@company.com, student@university.edu)' : undefined}
                required
              />

              <Input
                id="phoneNumber"
                label="Phone Number"
                type="tel"
                placeholder="0987654321"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                error={errors.phoneNumber}
                required
              />

              <div>
                <div className="relative">
                  <Input
                    id="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters with lowercase, number & special char"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('password', e.target.value)}
                    error={errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-11"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
                    ) : (
                      <Eye className="w-5 h-5" style={{ color: 'var(--auth-text-muted)' }} />
                    )}
                  </button>
                </div>
                <PasswordStrength password={formData.password} />
              </div>

              <div className="relative">
                <Input
                  id="confirmPassword"
                  label="Confirm password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('confirmPassword', e.target.value)}
                  error={errors.confirmPassword}
                  success={!!(formData.confirmPassword && formData.password === formData.confirmPassword && formData.confirmPassword.length >= 8)}
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

              {/* CAPTCHA Input */}
              <CaptchaInput
                onChange={(token) => handleChange('recaptchaToken', token || '')}
                error={errors.recaptcha}
              />

              <div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => handleChange('agreeToTerms', e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                    style={{
                      accentColor: 'var(--auth-primary)',
                    }}
                  />
                  <span style={{ color: 'var(--auth-text)', fontSize: '0.875rem' }}>
                    I agree to the{' '}
                    <a href="#" className="hover:underline" style={{ color: 'var(--auth-primary)' }}>
                      Terms and Conditions
                    </a>
                    {' '}and{' '}
                    <a href="#" className="hover:underline" style={{ color: 'var(--auth-primary)' }}>
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--auth-error)' }}>
                    {errors.agreeToTerms}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-3 text-base font-medium justify-center"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              <p className="text-center" style={{ color: 'var(--auth-text-muted)', fontSize: '0.875rem' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => onNavigateToSignIn ? onNavigateToSignIn() : navigate(ROUTES.LOGIN)}
                  className="hover:underline"
                  style={{ color: 'var(--auth-primary)', fontWeight: 500 }}
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </AuthLayout>
  );
}

export default SignUpPage;