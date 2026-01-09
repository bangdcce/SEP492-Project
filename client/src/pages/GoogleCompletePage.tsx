import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../shared/components/layouts/AuthLayout';
import { Input } from '../shared/components/custom/input';
import { Button } from '../shared/components/custom/Button';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/client';
import { ROUTES } from '@/constants';

type UserRole = 'client' | 'broker' | 'freelancer';

export function GoogleCompletePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: searchParams.get('email') || '',
    fullName: searchParams.get('fullName') || '',
    picture: searchParams.get('picture') || '',
    role: '' as UserRole | '',
    phoneNumber: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if this is a new user
    if (!searchParams.get('isNewUser')) {
      navigate(ROUTES.LOGIN);
    }
  }, [searchParams, navigate]);

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    return phoneRegex.test(phone);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.role) {
      newErrors.role = 'Please select your role';
    }

    if (formData.role === 'client' && !validateCorporateEmail(formData.email)) {
      newErrors.email = 'Business owners must use a corporate/organization email (not Gmail, Yahoo, Hotmail, etc.)';
    }

    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number. Format: 0[3|5|7|8|9]xxxxxxxx';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: any;
      }>('/auth/google/complete-signup', {
        email: formData.email,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        role: formData.role.toUpperCase(),
        picture: formData.picture,
      });

      // Save tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));

      toast.success('Account created successfully!');
      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      console.error('Complete signup error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to complete signup. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'client', label: 'Client (SME Owner)', icon: '🏢' },
    { value: 'broker', label: 'Broker', icon: '💼' },
    { value: 'freelancer', label: 'Freelancer (Developer)', icon: '💻' },
  ];

  return (
    <AuthLayout title="Complete Your Profile">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Picture */}
        {formData.picture && (
          <div className="flex justify-center">
            <img 
              src={formData.picture} 
              alt="Profile" 
              className="w-20 h-20 rounded-full border-2 border-teal-500"
            />
          </div>
        )}

        {/* Email (Read-only) */}
        <Input
          id="email"
          label="Email"
          type="email"
          value={formData.email}
          disabled
          helperText="From your Google account"
        />

        {/* Full Name (Read-only) */}
        <Input
          id="fullName"
          label="Full Name"
          type="text"
          value={formData.fullName}
          disabled
          helperText="From your Google account"
        />

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--auth-text)' }}>
            Select your role <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div className="grid gap-3">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, role: option.value as UserRole });
                  setErrors({ ...errors, role: '' });
                }}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  formData.role === option.value
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-teal-300'
                }`}
              >
                <span className="text-2xl">{option.icon}</span>
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
          {errors.role && (
            <p className="mt-2 text-sm text-red-600">{errors.role}</p>
          )}
        </div>

        {/* Phone Number */}
        <Input
          id="phoneNumber"
          label="Phone Number"
          type="tel"
          placeholder="0987654321"
          value={formData.phoneNumber}
          onChange={(e) => {
            setFormData({ ...formData, phoneNumber: e.target.value });
            setErrors({ ...errors, phoneNumber: '' });
          }}
          error={errors.phoneNumber}
          helperText="Vietnam format: 0[3|5|7|8|9]xxxxxxxx"
          required
        />

        <Button 
          type="submit" 
          variant="primary" 
          className="w-full py-3 text-base font-medium justify-center"
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Complete Sign Up'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default GoogleCompletePage;
