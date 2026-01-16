import React, { useState } from 'react';

import { Upload, Camera, User, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { Input } from '@/shared/components/custom/input';
import { toast } from 'sonner';

interface KYCFormData {
  // Personal Information
  fullName: string;
  dateOfBirth: string;
  idNumber: string;
  address: string;
  
  // Identity Documents
  idCardFront: File | null;
  idCardBack: File | null;
  
  // Selfie
  selfiePhoto: File | null;
}

export default function KYCPage() {

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<KYCFormData>({
    fullName: '',
    dateOfBirth: '',
    idNumber: '',
    address: '',
    idCardFront: null,
    idCardBack: null,
    selfiePhoto: null,
  });
  const [previews, setPreviews] = useState({
    idCardFront: '',
    idCardBack: '',
    selfiePhoto: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const steps = [
    { number: 1, title: 'Personal Info', icon: User },
    { number: 2, title: 'ID Verification', icon: Upload },
    { number: 3, title: 'Selfie', icon: Camera },
  ];

  const handleFileChange = (field: 'idCardFront' | 'idCardBack' | 'selfiePhoto', file: File | null) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, [field]: 'Please upload an image file' }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, [field]: 'File size must be less than 5MB' }));
        return;
      }

      setFormData(prev => ({ ...prev, [field]: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
      
      // Clear error
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, field: 'idCardFront' | 'idCardBack' | 'selfiePhoto') => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(field, file);
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }
    
    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'ID number is required';
    } else if (!/^\d{9,12}$/.test(formData.idNumber.trim())) {
      newErrors.idNumber = 'Invalid ID number (9-12 digits)';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.idCardFront) {
      newErrors.idCardFront = 'Please upload the front of your ID card';
    }
    
    if (!formData.idCardBack) {
      newErrors.idCardBack = 'Please upload the back of your ID card';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.selfiePhoto) {
      newErrors.selfiePhoto = 'Please upload a selfie photo';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = validateStep1();
    } else if (currentStep === 2) {
      isValid = validateStep2();
    } else if (currentStep === 3) {
      isValid = validateStep3();
    }
    
    if (isValid && currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else if (isValid && currentStep === 3) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('fullNameOnDocument', formData.fullName);
      submitData.append('dateOfBirth', formData.dateOfBirth);
      submitData.append('documentNumber', formData.idNumber);
      submitData.append('documentType', 'CCCD');
      
      if (formData.idCardFront) {
        submitData.append('idCardFront', formData.idCardFront);
      }
      if (formData.idCardBack) {
        submitData.append('idCardBack', formData.idCardBack);
      }
      if (formData.selfiePhoto) {
        submitData.append('selfie', formData.selfiePhoto);
      }
      
      // Call KYC API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/kyc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit KYC');
      }
      
      toast.success('KYC verification submitted successfully! We will review your information.');
      
      // Redirect to client dashboard
      window.location.href = '/client/dashboard';
    } catch (error: any) {
      console.error('KYC submission error:', error);
      toast.error(error.message || 'Failed to submit KYC. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderUploadBox = (
    field: 'idCardFront' | 'idCardBack' | 'selfiePhoto',
    label: string,
    icon: React.ReactNode
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      
      <div
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, field)}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50'
        }`}
      >
        {previews[field] ? (
          <div className="space-y-3">
            <img
              src={previews[field]}
              alt={label}
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, [field]: null }));
                setPreviews(prev => ({ ...prev, [field]: '' }));
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(field, e.target.files?.[0] || null)}
            />
            <div className="flex flex-col items-center">
              <div className="text-gray-400 mb-3">{icon}</div>
              <p className="text-sm text-gray-600 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, JPEG (max 5MB)
              </p>
            </div>
          </label>
        )}
      </div>
      
      {errors[field] && (
        <p className="mt-2 text-sm text-red-600">{errors[field]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Identity Verification (KYC)
          </h1>
          <p className="text-gray-600">
            Please provide your information for identity verification
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        isActive ? 'text-blue-600' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-colors ${
                        currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>
              
              <Input
                id="fullName"
                label="Full Name (as shown on ID)"
                type="text"
                placeholder="Nguyen Van A"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                error={errors.fullName}
                required
              />
              
              <Input
                id="dateOfBirth"
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                error={errors.dateOfBirth}
                required
              />
              
              <Input
                id="idNumber"
                label="ID Card Number (CCCD)"
                type="text"
                placeholder="001234567890"
                value={formData.idNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                error={errors.idNumber}
                helperText="Enter 9-12 digit ID number"
                required
              />
              
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="address"
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="123 Street Name, Ward, District, City"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
                {errors.address && (
                  <p className="mt-2 text-sm text-red-600">{errors.address}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: ID Verification */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload ID Card Photos
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderUploadBox(
                  'idCardFront',
                  'ID Card - Front Side',
                  <Upload className="w-12 h-12" />
                )}
                
                {renderUploadBox(
                  'idCardBack',
                  'ID Card - Back Side',
                  <Upload className="w-12 h-12" />
                )}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Tips for better verification:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                  <li>Make sure the ID card is clearly visible</li>
                  <li>Avoid glare or shadows</li>
                  <li>All text should be readable</li>
                  <li>Photo should not be blurry</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 3: Selfie Verification */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Selfie Photo
              </h2>
              
              {renderUploadBox(
                'selfiePhoto',
                'Selfie with ID Card',
                <Camera className="w-12 h-12" />
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Selfie requirements:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
                  <li>Hold your ID card next to your face</li>
                  <li>Make sure your face is clearly visible</li>
                  <li>Good lighting (avoid too bright or too dark)</li>
                  <li>Look straight at the camera</li>
                  <li>Do not wear sunglasses or hat</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {currentStep === 3 ? (
                loading ? 'Submitting...' : 'Submit'
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 Your information is encrypted and securely stored</p>
        </div>
      </div>
    </div>
  );
}
