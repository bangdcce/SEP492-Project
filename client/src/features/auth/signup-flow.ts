export type FrontendSignUpRole = 'client' | 'broker' | 'freelancer' | 'staff';

export interface UploadLike {
  name?: string;
  type: string;
  size: number;
}

export interface StaffKycDraft {
  fullNameOnDocument: string;
  documentType: string;
  documentNumber: string;
  dateOfBirth: string;
  address: string;
  idCardFront?: UploadLike | null;
  idCardBack?: UploadLike | null;
  selfie?: UploadLike | null;
}

export const STAFF_CV_MAX_SIZE = 5 * 1024 * 1024;
export const STAFF_CV_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const isStaffRole = (role: FrontendSignUpRole | ''): role is 'staff' => role === 'staff';

export const isTaxonomyRole = (
  role: FrontendSignUpRole | '',
): role is 'broker' | 'freelancer' => role === 'broker' || role === 'freelancer';

export const getSignupStepLabels = (role: FrontendSignUpRole | '') => {
  if (isStaffRole(role)) {
    return ['Role', 'Account Info', 'Upload CV', 'Manual KYC'];
  }

  if (isTaxonomyRole(role)) {
    return ['Role', 'Account Info', 'Domain', 'Skills'];
  }

  return ['Role', 'Account Info'];
};

export const getSignupTransport = (role: FrontendSignUpRole | '') => {
  if (isStaffRole(role)) {
    return {
      endpoint: '/auth/register/staff',
      mode: 'multipart' as const,
    };
  }

  return {
    endpoint: '/auth/register',
    mode: 'json' as const,
  };
};

export const validateStaffCvFile = (file?: UploadLike | null): string | null => {
  if (!file) {
    return 'CV is required';
  }

  if (!STAFF_CV_ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'Only PDF and DOCX files are allowed';
  }

  if (file.size > STAFF_CV_MAX_SIZE) {
    return 'File size must not exceed 5MB';
  }

  return null;
};

const validateImageUpload = (file: UploadLike | null | undefined, label: string) => {
  if (!file) {
    return `${label} is required`;
  }

  if (!file.type.startsWith('image/')) {
    return `${label} must be a valid image file`;
  }

  return null;
};

export const validateStaffKycDraft = (draft: StaffKycDraft) => {
  const errors: Record<string, string> = {};

  if (!draft.fullNameOnDocument.trim()) {
    errors.fullNameOnDocument = 'Full name on document is required';
  }

  if (!draft.documentType.trim()) {
    errors.documentType = 'Document type is required';
  }

  if (!draft.documentNumber.trim()) {
    errors.documentNumber = 'Document number is required';
  }

  if (!draft.dateOfBirth.trim()) {
    errors.dateOfBirth = 'Date of birth is required';
  }

  if (!draft.address.trim()) {
    errors.address = 'Address is required';
  }

  const idCardFrontError = validateImageUpload(draft.idCardFront, 'ID card front image');
  if (idCardFrontError) {
    errors.idCardFront = idCardFrontError;
  }

  const idCardBackError = validateImageUpload(draft.idCardBack, 'ID card back image');
  if (idCardBackError) {
    errors.idCardBack = idCardBackError;
  }

  const selfieError = validateImageUpload(draft.selfie, 'Selfie image');
  if (selfieError) {
    errors.selfie = selfieError;
  }

  return errors;
};
