import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '../shared/components/custom/input';
import { Button } from '../shared/components/custom/Button';
// import { GoogleButton } from '../shared/components/auth/GoogleButton';
import { PasswordStrength } from '../shared/components/auth/PasswordStrength';
import { CaptchaInput } from '../shared/components/auth/CaptchaInput';
import { AuthLayout } from '../shared/components/layouts/AuthLayout';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Building2, Store, Briefcase, Laptop, X } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/constants';
import { signUp, getSkillDomains, getSkills, type SkillDomain, type Skill } from '@/features/auth';
import TermsOfService from '@/components/legal/TermsOfService';
import PrivacyPolicy from '@/components/legal/PrivacyPolicy';

interface SignUpPageProps {
  onNavigateToSignIn?: () => void;
  onSignUpSuccess?: () => void;
}

type UserRole = 'client_large' | 'client_small' | 'broker' | 'freelancer';

export function SignUpPage({ onNavigateToSignIn, onSignUpSuccess }: SignUpPageProps = {}) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1: Role Selection, 2: Info Form, 3: Domain (Freelancer/Broker), 4: Skills (Freelancer/Broker)
  const [formData, setFormData] = useState({
    role: '' as UserRole | '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptPrivacy: false,
    recaptchaToken: '',
    domains: [] as string[], // Domain IDs (UUIDs)
    skills: [] as string[], // Skill IDs (UUIDs)
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // State for domains and skills from API
  const [availableDomains, setAvailableDomains] = useState<SkillDomain[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Fetch domains when entering step 3
  useEffect(() => {
    if (currentStep === 3 && availableDomains?.length === 0) {
      setLoadingDomains(true);
      getSkillDomains()
        .then(domains => {
          console.log('Loaded domains:', domains);
          setAvailableDomains(domains || []);
        })
        .catch(err => {
          console.error('Failed to load domains:', err);
          toast.error('Failed to load domains');
          setAvailableDomains([]);
        })
        .finally(() => setLoadingDomains(false));
    }
  }, [currentStep]);

  // Fetch skills when entering step 4
  useEffect(() => {
    if (currentStep === 4 && availableSkills?.length === 0) {
      setLoadingSkills(true);
      const role = formData.role === 'freelancer' ? 'FREELANCER' : 'BROKER';
      getSkills(role)
        .then(skills => setAvailableSkills(skills || []))
        .catch(err => {
          console.error('Failed to load skills:', err);
          toast.error('Failed to load skills');
          setAvailableSkills([]);
        })
        .finally(() => setLoadingSkills(false));
    }
  }, [currentStep, formData.role]);

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

  // Password is valid if it meets minimum length and at least 2 out of 3 character types (medium strength)
  const isPasswordValid = passwordRequirements.minLength && (
    [passwordRequirements.hasLowerCase, passwordRequirements.hasNumber, passwordRequirements.hasSpecial]
      .filter(Boolean).length >= 2
  );

  // Check if Step 2 (Info Form) is valid
  const isStep2Valid = () => {
    if (!formData.fullName || formData.fullName.length < 2) return false;
    if (!formData.email || !validateEmail(formData.email)) return false;
    if (formData.role === 'client_large' && !validateCorporateEmail(formData.email)) return false;
    if (!formData.phoneNumber || !validatePhone(formData.phoneNumber)) return false;
    if (!formData.password || !isPasswordValid) return false;
    if (!formData.confirmPassword || formData.password !== formData.confirmPassword) return false;
    if (!formData.acceptTerms || !formData.acceptPrivacy) return false;
    if (!formData.recaptchaToken) return false;
    return true;
  };

  // Check if Step 3 (Domain Selection) is valid
  const isStep3Valid = () => {
    return formData.domains.length > 0;
  };

  // Check if Step 4 (Skill Selection) is valid
  const isStep4Valid = () => {
    return formData.skills.length > 0;
  };

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

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the Terms of Service';
    }

    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = 'You must accept the Privacy Policy';
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
        domainIds: formData.domains.length > 0 ? formData.domains : undefined,
        skillIds: formData.skills.length > 0 ? formData.skills : undefined,
        acceptTerms: formData.acceptTerms,
        acceptPrivacy: formData.acceptPrivacy,
      });

      toast.success('Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.');

      if (onSignUpSuccess) {
        onSignUpSuccess();
      } else {
        const pendingUrl = `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(formData.email)}`;
        navigate(pendingUrl);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      console.error('Error response:', error.response?.data);

      // Handle error message (could be string, array, or object)
      let errorMessage = 'Failed to create account. Please try again.';

      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        if (typeof msg === 'string') {
          errorMessage = msg;
        } else if (Array.isArray(msg)) {
          errorMessage = msg.join(', ');
        } else if (typeof msg === 'object') {
          errorMessage = JSON.stringify(msg);
        }
      }

      // Check if error is related to duplicate email
      if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('email')) {
        setErrors({ email: errorMessage });
      } else if (typeof errorMessage === 'string' && (errorMessage.toLowerCase().includes('captcha') || errorMessage.toLowerCase().includes('recaptcha'))) {
        setErrors({ recaptcha: errorMessage });
      } else if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('terms')) {
        setErrors({ acceptTerms: errorMessage });
      } else if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('privacy')) {
        setErrors({ acceptPrivacy: errorMessage });
      } else {
        setErrors({ acceptTerms: errorMessage });
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

  const handleInfoFormNext = () => {
    // Validation for step 2
    const newErrors: Record<string, string> = {};

    if (!formData.fullName) newErrors.fullName = 'Full name is required';

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
      newErrors.password = 'Password must be at least 8 characters with 2 of: lowercase, number, special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept Terms of Service';
    if (!formData.acceptPrivacy) newErrors.acceptPrivacy = 'You must accept Privacy Policy';
    if (!formData.recaptchaToken) newErrors.recaptcha = 'Complete reCAPTCHA';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If Freelancer or Broker → go to Domain selection (Step 3)
    if (formData.role === 'freelancer' || formData.role === 'broker') {
      setCurrentStep(3);
    } else {
      // Client roles → submit immediately
      handleSubmit(new Event('submit') as any);
    }
  };

  const handleDomainNext = () => {
    if (formData.domains.length === 0) {
      setErrors({ domains: 'Please select at least one domain' });
      return;
    }
    setCurrentStep(4); // Go to Skills selection
  };

  const handleSkillsNext = () => {
    if (formData.skills.length === 0) {
      setErrors({ skills: 'Please select at least one skill' });
      return;
    }
    // All steps completed → submit
    handleSubmit(new Event('submit') as any);
  };

  const toggleDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter(d => d !== domain)
        : [...prev.domains, domain]
    }));
    if (errors.domains) setErrors(prev => ({ ...prev, domains: '' }));
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
    if (errors.skills) setErrors(prev => ({ ...prev, skills: '' }));
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
    if (currentStep === 1) return 'Choose Your Role';
    if (currentStep === 2) return 'Complete Your Profile';
    if (currentStep === 3) return 'Select Your Domains';
    if (currentStep === 4) return 'Choose Your Skills';
    return 'Sign Up';
  };

  const getStepSubtitle = () => {
    if (currentStep === 1) return 'Tell us what brings you to our platform';
    if (currentStep === 2) return `You're signing up as ${formData.role ? getRoleLabel(formData.role) : 'a user'}`;
    if (currentStep === 3) return 'What industries/areas do you specialize in?';
    if (currentStep === 4) return 'What technologies/skills do you work with?';
    return '';
  };

  const totalSteps = (formData.role === 'freelancer' || formData.role === 'broker') ? 4 : 2;

  return (
    <AuthLayout
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
    >
      {/* Progress Indicator */}
      <div style={{ marginBottom: '2rem' }}>
        {/* Progress bars */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[...Array(totalSteps)].map((_, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: currentStep > idx ? '#14b8a6' : 'var(--auth-border)',
                transition: 'background-color 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Step labels with numbers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: totalSteps === 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: '0.5rem',
        }}>
          {/* Step 1 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: currentStep === 1 ? '#14b8a6' : currentStep > 1 ? '#14b8a6' : 'var(--auth-border)',
              color: currentStep >= 1 ? 'white' : 'var(--auth-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}>
              {currentStep > 1 ? '✓' : '1'}
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: currentStep === 1 ? 600 : 400,
              color: currentStep === 1 ? '#14b8a6' : 'var(--auth-text-muted)',
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}>
              Role
            </span>
          </div>

          {/* Step 2 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: currentStep === 2 ? '#14b8a6' : currentStep > 2 ? '#14b8a6' : 'var(--auth-border)',
              color: currentStep >= 2 ? 'white' : 'var(--auth-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}>
              {currentStep > 2 ? '✓' : '2'}
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: currentStep === 2 ? 600 : 400,
              color: currentStep === 2 ? '#14b8a6' : 'var(--auth-text-muted)',
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}>
              Details
            </span>
          </div>

          {/* Step 3 (only for Freelancer/Broker) */}
          {totalSteps === 4 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: currentStep === 3 ? '#14b8a6' : currentStep > 3 ? '#14b8a6' : 'var(--auth-border)',
                color: currentStep >= 3 ? 'white' : 'var(--auth-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.3s ease',
              }}>
                {currentStep > 3 ? '✓' : '3'}
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: currentStep === 3 ? 600 : 400,
                color: currentStep === 3 ? '#14b8a6' : 'var(--auth-text-muted)',
                textAlign: 'center',
                transition: 'all 0.3s ease',
              }}>
                Domains
              </span>
            </div>
          )}

          {/* Step 4 (only for Freelancer/Broker) */}
          {totalSteps === 4 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: currentStep === 4 ? '#14b8a6' : 'var(--auth-border)',
                color: currentStep === 4 ? 'white' : 'var(--auth-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.3s ease',
              }}>
                4
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: currentStep === 4 ? 600 : 400,
                color: currentStep === 4 ? '#14b8a6' : 'var(--auth-text-muted)',
                textAlign: 'center',
                transition: 'all 0.3s ease',
              }}>
                Skills
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
        <AnimatePresence mode="wait" custom={currentStep}>
          {currentStep === 1 && (
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
          )}

          {currentStep === 2 && (
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

              <div style={{ marginBottom: '1.2rem' }}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.acceptTerms && formData.acceptPrivacy}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      handleChange('acceptTerms', checked);
                      handleChange('acceptPrivacy', checked);
                    }}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                    style={{
                      accentColor: '#14b8a6',
                    }}
                  />
                  <span style={{ color: 'var(--auth-text)', fontSize: '0.875rem' }}>
                    I accept the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="hover:underline font-medium"
                      style={{ color: '#14b8a6' }}
                    >
                      Terms of Service
                    </button>
                    {' and '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPrivacyModal(true);
                      }}
                      className="hover:underline font-medium"
                      style={{ color: '#14b8a6' }}
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>
                {(errors.acceptTerms || errors.acceptPrivacy) && (
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--auth-error)' }}>
                    {errors.acceptTerms || errors.acceptPrivacy}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleInfoFormNext}
                variant="primary"
                className="w-full py-3 text-base font-medium justify-center"
                disabled={loading || !isStep2Valid()}
              >
                {(formData.role === 'freelancer' || formData.role === 'broker') ? 'Next' : (loading ? 'Creating account...' : 'Create Account')}
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

          {/* STEP 3: Domain Selection (Freelancer/Broker only) */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              custom={3}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
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
              >
                <ArrowLeft className="w-4 h-4" />
                Back to profile
              </button>

              <div className="space-y-4">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--auth-text)', marginBottom: '1rem' }}>
                  Select domains you work in (choose at least 1)
                </label>
                {loadingDomains ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--auth-text-muted)' }}>
                    Loading domains...
                  </div>
                ) : availableDomains && availableDomains.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    {availableDomains.map((domain) => (
                      <button
                        key={domain.id}
                        type="button"
                        onClick={() => toggleDomain(domain.id)}
                        style={{
                          padding: '1rem',
                          border: `2px solid ${formData.domains.includes(domain.id) ? 'var(--auth-primary)' : 'var(--auth-border)'}`,
                          borderRadius: '12px',
                          backgroundColor: formData.domains.includes(domain.id) ? 'rgba(37, 99, 235, 0.05)' : 'var(--auth-input-bg)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {domain.icon && (
                          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{domain.icon}</div>
                        )}
                        <div style={{ fontWeight: 600, color: 'var(--auth-text)', fontSize: '0.875rem' }}>
                          {domain.name}
                        </div>
                        {domain.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--auth-text-muted)', marginTop: '0.25rem' }}>
                            {domain.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--auth-error)' }}>
                    <p>No domains available. Please contact administrator.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--auth-text-muted)' }}>
                      Database may need to be seeded with domain data.
                    </p>
                  </div>
                )}
                {errors.domains && (
                  <p style={{ color: 'var(--auth-error)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {errors.domains}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleDomainNext}
                variant="primary"
                className="w-full py-3 text-base font-medium justify-center mt-6"
                disabled={!isStep3Valid()}
              >
                Next
              </Button>
            </motion.div>
          )}

          {/* STEP 4: Skills Selection (Freelancer/Broker only) */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              custom={4}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
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
              >
                <ArrowLeft className="w-4 h-4" />
                Back to domains
              </button>

              <div className="space-y-4">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--auth-text)', marginBottom: '1rem' }}>
                  Select your skills/technologies (choose at least 1)
                </label>
                {loadingSkills ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--auth-text-muted)' }}>
                    Loading skills...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {availableSkills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          border: `2px solid ${formData.skills.includes(skill.id) ? 'var(--auth-primary)' : 'var(--auth-border)'}`,
                          borderRadius: '20px',
                          backgroundColor: formData.skills.includes(skill.id) ? 'var(--auth-primary)' : 'transparent',
                          color: formData.skills.includes(skill.id) ? 'white' : 'var(--auth-text)',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                )}
                {errors.skills && (
                  <p style={{ color: 'var(--auth-error)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {errors.skills}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleSkillsNext}
                variant="primary"
                className="w-full py-3 text-base font-medium justify-center mt-6"
                disabled={loading || !isStep4Valid()}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTermsModal(false)}
              className="sticky top-4 right-4 float-right bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <TermsOfService />
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="sticky top-4 right-4 float-right bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <PrivacyPolicy />
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default SignUpPage;
