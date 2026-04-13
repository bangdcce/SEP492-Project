import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../shared/components/custom/input";
import { Button } from "../shared/components/custom/Button";
// import { GoogleButton } from '../shared/components/auth/GoogleButton';
import { PasswordStrength } from '../shared/components/auth/PasswordStrength';
import { CaptchaInput } from '../shared/components/auth/CaptchaInput';
import { AuthLayout } from '../shared/components/layouts/AuthLayout';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Store, Briefcase, Laptop, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/constants';
import { signUp, signUpStaff, getSkillDomains, getSkills, type SkillDomain, type Skill } from '@/features/auth';
import {
  getSignupStepLabels,
  isStaffRole,
  isTaxonomyRole,
  validateStaffCvFile,
  validateStaffKycDraft,
} from '@/features/auth/signup-flow';

interface SignUpPageProps {
  onNavigateToSignIn?: () => void;
  onSignUpSuccess?: () => void;
}

const CUSTOM_DOMAIN_PREFIX = "__other_domain__:";
const CUSTOM_SKILL_PREFIX = "__other_skill__:";

type UserRole = 'client' | 'broker' | 'freelancer' | 'staff';

export function SignUpPage({
  onNavigateToSignIn,
  onSignUpSuccess,
}: SignUpPageProps = {}) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1: Role Selection, 2: Info Form, 3: Domain (Freelancer/Broker), 4: Skills (Freelancer/Broker)
  const [formData, setFormData] = useState({
    role: "" as UserRole | "",
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    acceptPrivacy: false,
    recaptchaToken: "",
    domains: [] as string[], // Domain IDs (UUIDs)
    skills: [] as string[], // Skill IDs (UUIDs)
    customDomains: [] as string[],
    customSkills: [] as string[],
    staffCv: null as File | null,
    fullNameOnDocument: "",
    documentType: "CCCD",
    documentNumber: "",
    dateOfBirth: "",
    address: "",
    idCardFront: null as File | null,
    idCardBack: null as File | null,
    selfie: null as File | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // State for domains and skills from API
  const [availableDomains, setAvailableDomains] = useState<SkillDomain[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");

  // Fetch domains when entering step 3
  useEffect(() => {
    if (currentStep === 3 && isTaxonomyRole(formData.role) && availableDomains?.length === 0) {
      setLoadingDomains(true);
      getSkillDomains()
        .then((domains) => {
          const filteredDomains = (domains || []).filter(
            (domain) =>
              !domain.description ||
              !domain.description.toLowerCase().startsWith("user-added"),
          );
          setAvailableDomains(filteredDomains);
        })
        .catch((err) => {
          toast.error("Failed to load domains");
          setAvailableDomains([]);
        })
        .finally(() => setLoadingDomains(false));
    }
  }, [currentStep, formData.role, availableDomains?.length]);

  // Fetch skills when entering step 4
  useEffect(() => {
    if (currentStep === 4 && isTaxonomyRole(formData.role)) {
      setLoadingSkills(true);
      const role =
        formData.role === "freelancer"
          ? "FREELANCER"
          : "BROKER";
      getSkills(role)
        .then((skills) => {
          const filteredSkills = (skills || []).filter(
            (skill) =>
              !skill.description ||
              !skill.description.toLowerCase().startsWith("user-added"),
          );
          setAvailableSkills(filteredSkills);
        })
        .catch((err) => {
          toast.error("Failed to load skills");
          setAvailableSkills([]);
        })
        .finally(() => setLoadingSkills(false));
    }
  }, [currentStep, formData.role]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;

    // Whitelist: only allow trusted email providers
    const allowedDomains = [
      // Google
      'gmail.com', 'googlemail.com',
      // Microsoft
      'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
      // Yahoo
      'yahoo.com', 'yahoo.com.vn', 'ymail.com',
      // Apple
      'icloud.com', 'me.com', 'mac.com',
      // Proton
      'protonmail.com', 'proton.me', 'pm.me',
      // Other trusted providers
      'aol.com', 'mail.com', 'zoho.com', 'gmx.com', 'tutanota.com',
      // Vietnamese providers
      'vnu.edu.vn', 'hust.edu.vn', 'uit.edu.vn', 'fpt.edu.vn', 'vku.udn.vn',
      // Corporate domains (allow for staff/enterprise)
      // Add more as needed
    ];
    
    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return false;
    
    // Check if domain is in whitelist OR is an educational/corporate domain
    const isAllowedDomain = allowedDomains.includes(domain);
    const isEducationalDomain = domain.endsWith('.edu.vn') || domain.endsWith('.edu');
    
    return isAllowedDomain || isEducationalDomain;
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
  const isPasswordValid =
    passwordRequirements.minLength &&
    [
      passwordRequirements.hasLowerCase,
      passwordRequirements.hasNumber,
      passwordRequirements.hasSpecial,
    ].filter(Boolean).length >= 2;

  // Check if Step 2 (Info Form) is valid
  const isStep2Valid = () => {
    if (!formData.fullName || formData.fullName.length < 2) return false;
    if (!formData.email || !validateEmail(formData.email)) return false;
    if (!formData.phoneNumber || !validatePhone(formData.phoneNumber)) return false;
    if (!formData.password || !isPasswordValid) return false;
    if (
      !formData.confirmPassword ||
      formData.password !== formData.confirmPassword
    )
      return false;
    if (!formData.acceptTerms || !formData.acceptPrivacy) return false;
    if (!formData.recaptchaToken) return false;
    return true;
  };

  // Check if Step 3 (Domain Selection) is valid
  const isStep3Valid = () => {
    if (isStaffRole(formData.role)) {
      return !validateStaffCvFile(formData.staffCv);
    }
    return formData.domains.length > 0 || formData.customDomains.length > 0;
  };

  // Check if Step 4 (Skill Selection) is valid
  const isStep4Valid = () => {
    if (isStaffRole(formData.role)) {
      return Object.keys(
        validateStaffKycDraft({
          fullNameOnDocument: formData.fullNameOnDocument,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          dateOfBirth: formData.dateOfBirth,
          address: formData.address,
          idCardFront: formData.idCardFront,
          idCardBack: formData.idCardBack,
          selfie: formData.selfie,
        }),
      ).length === 0;
    }
    return formData.skills.length > 0 || formData.customSkills.length > 0;
  };

  // Shared function to perform the actual sign up API call
  const performSignUp = async () => {
    setErrors({});
    setLoading(true);

    try {
      if (isStaffRole(formData.role)) {
        const payload = new FormData();
        payload.append("email", formData.email);
        payload.append("password", formData.password);
        payload.append("fullName", formData.fullName);
        payload.append("phoneNumber", formData.phoneNumber);
        payload.append("recaptchaToken", formData.recaptchaToken);
        payload.append("acceptTerms", String(formData.acceptTerms));
        payload.append("acceptPrivacy", String(formData.acceptPrivacy));
        payload.append("fullNameOnDocument", formData.fullNameOnDocument);
        payload.append("documentType", "CCCD");
        payload.append("documentNumber", formData.documentNumber);
        payload.append("dateOfBirth", formData.dateOfBirth);
        payload.append("address", formData.address);
        payload.append("cv", formData.staffCv as Blob);
        payload.append("idCardFront", formData.idCardFront as Blob);
        payload.append("idCardBack", formData.idCardBack as Blob);
        payload.append("selfie", formData.selfie as Blob);
        await signUpStaff(payload);
      } else {
        const payload: any = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          role: formData.role.toUpperCase(),
          recaptchaToken: formData.recaptchaToken,
          acceptTerms: formData.acceptTerms,
          acceptPrivacy: formData.acceptPrivacy,
        };

        if (isTaxonomyRole(formData.role)) {
          const mergedDomainIds = [
            ...formData.domains,
            ...formData.customDomains.map((value) => `${CUSTOM_DOMAIN_PREFIX}${value}`),
          ];
          const mergedSkillIds = [
            ...formData.skills,
            ...formData.customSkills.map((value) => `${CUSTOM_SKILL_PREFIX}${value}`),
          ];

          if (mergedDomainIds.length > 0) payload.domainIds = mergedDomainIds;
          if (mergedSkillIds.length > 0) payload.skillIds = mergedSkillIds;
        }

        await signUp(payload);
      }

      toast.success(
        'Registration successful. Please check your email to verify your account.',
      );

      if (onSignUpSuccess) {
        onSignUpSuccess();
      } else {
        const pendingUrl = `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(formData.email)}`;
        navigate(pendingUrl);
      }
    } catch (error: any) {
      // Handle error message (could be string, array, or object)
      let errorMessage = "Failed to create account. Please try again.";

      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        if (typeof msg === "string") {
          errorMessage = msg;
        } else if (Array.isArray(msg)) {
          errorMessage = msg.join(", ");
        } else if (typeof msg === "object") {
          errorMessage = JSON.stringify(msg);
        }
      }

      // Check if error is related to duplicate email
      if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("email")
      ) {
        setErrors({ email: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        (errorMessage.toLowerCase().includes("cv") ||
          errorMessage.toLowerCase().includes("pdf") ||
          errorMessage.toLowerCase().includes("docx") ||
          errorMessage.toLowerCase().includes("5mb"))
      ) {
        setErrors({ staffCv: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        (errorMessage.toLowerCase().includes("captcha") ||
          errorMessage.toLowerCase().includes("recaptcha"))
      ) {
        setErrors({ recaptcha: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("fullnameondocument")
      ) {
        setErrors({ fullNameOnDocument: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("documenttype")
      ) {
        setErrors({ documentType: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("documentnumber")
      ) {
        setErrors({ documentNumber: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("dateofbirth")
      ) {
        setErrors({ dateOfBirth: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("address")
      ) {
        setErrors({ address: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("front")
      ) {
        setErrors({ idCardFront: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("back")
      ) {
        setErrors({ idCardBack: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("selfie")
      ) {
        setErrors({ selfie: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("terms")
      ) {
        setErrors({ acceptTerms: errorMessage });
      } else if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("privacy")
      ) {
        setErrors({ acceptPrivacy: errorMessage });
      } else {
        setErrors({ acceptTerms: errorMessage });
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
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
      newErrors.email = 'Please use a valid email from trusted providers (Gmail, Outlook, Yahoo, etc.) or educational institutions.';
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

    // Perform sign up
    await performSignUp();
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'client':
        return 'Business Owner / Client';
      case 'broker':
        return 'Broker (Project Consultant)';
      case 'freelancer':
        return 'Freelancer (Developer)';
      case 'staff':
        return 'Staff (Internal Reviewer)';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'client':
        return 'I need software solutions for my business or personal project';
      case 'broker':
        return 'I help translate business needs into technical requirements';
      case 'freelancer':
        return 'I build software and deliver projects';
      case 'staff':
        return 'I want to apply for an internal staff role and review platform work';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'client':
        return Store;
      case "broker":
        return Briefcase;
      case "freelancer":
        return Laptop;
      case "staff":
        return ShieldCheck;
    }
  };
  const handleRoleSelect = (role: UserRole) => {
    handleChange("role", role);
    // Auto-advance to next step after selecting role
    setTimeout(() => {
      setCurrentStep(2);
    }, 300);
  };

  const handleInfoFormNext = async () => {
    // Validation for step 2
    const newErrors: Record<string, string> = {};

    if (!formData.fullName) newErrors.fullName = "Full name is required";

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please use a valid email from trusted providers (Gmail, Outlook, Yahoo, etc.) or educational institutions.';
    }

    if (!formData.phoneNumber) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber =
        "Invalid phone number. Format: 0[3|5|7|8|9]xxxxxxxx";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordValid) {
      newErrors.password =
        "Password must be at least 8 characters with 2 of: lowercase, number, special character";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.acceptTerms)
      newErrors.acceptTerms = "You must accept Terms of Service";
    if (!formData.acceptPrivacy)
      newErrors.acceptPrivacy = "You must accept Privacy Policy";
    if (!formData.recaptchaToken) newErrors.recaptcha = "Complete reCAPTCHA";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If Freelancer or Broker Ä‚Â¢Ă¢â‚¬Â Ă¢â‚¬â„¢ go to Domain selection (Step 3)
    if (isStaffRole(formData.role) || isTaxonomyRole(formData.role)) {
      setCurrentStep(3);
    } else {
      // Client Ä‚Â¢Ă¢â‚¬Â Ă¢â‚¬â„¢ submit immediately (only 2 steps: role + info)
      await performSignUp();
    }
  };

  const handleDomainNext = () => {
    if (isStaffRole(formData.role)) {
      const cvError = validateStaffCvFile(formData.staffCv);
      if (cvError) {
        setErrors({ staffCv: cvError });
        return;
      }
      setCurrentStep(4);
      return;
    }

    if (formData.domains.length === 0 && formData.customDomains.length === 0) {
      setErrors({ domains: "Please select at least one domain" });
      return;
    }
    setCurrentStep(4); // Go to Skills selection
  };

  const handleSkillsNext = () => {
    if (isStaffRole(formData.role)) {
      const kycErrors = validateStaffKycDraft({
        fullNameOnDocument: formData.fullNameOnDocument,
        documentType: formData.documentType,
        documentNumber: formData.documentNumber,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        idCardFront: formData.idCardFront,
        idCardBack: formData.idCardBack,
        selfie: formData.selfie,
      });

      if (Object.keys(kycErrors).length > 0) {
        setErrors(kycErrors);
        return;
      }

      handleSubmit(new Event("submit") as any);
      return;
    }

    if (formData.skills.length === 0 && formData.customSkills.length === 0) {
      setErrors({ skills: "Please select at least one skill" });
      return;
    }
    // All steps completed Ä‚Â¢Ă¢â‚¬Â Ă¢â‚¬â„¢ submit
    handleSubmit(new Event("submit") as any);
  };

  const toggleDomain = (domain: string) => {
    setFormData((prev) => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter((d) => d !== domain)
        : [...prev.domains, domain],
    }));
    if (errors.domains) setErrors((prev) => ({ ...prev, domains: "" }));
  };

  const toggleSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
    if (errors.skills) setErrors((prev) => ({ ...prev, skills: "" }));
  };

  const sanitizeCustomLabel = (value: string) =>
    value
      .replace(/\s+/g, " ")
      .trim();

  const addCustomDomain = () => {
    const value = sanitizeCustomLabel(customDomainInput);
    if (!value) return;

    if (value.length < 2) {
      setErrors((prev) => ({ ...prev, domains: "Custom domain must be at least 2 characters" }));
      return;
    }

    if (formData.customDomains.length >= 5) {
      setErrors((prev) => ({ ...prev, domains: "You can add up to 5 custom domains" }));
      return;
    }

    const normalizedValue = value.toLowerCase();
    const duplicateInMaster = availableDomains.some(
      (domain) => domain.name.toLowerCase() === normalizedValue,
    );
    const duplicateInCustom = formData.customDomains.some(
      (domain) => domain.toLowerCase() === normalizedValue,
    );

    if (duplicateInMaster || duplicateInCustom) {
      setErrors((prev) => ({ ...prev, domains: "This domain already exists" }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      customDomains: [...prev.customDomains, value],
    }));
    setCustomDomainInput("");
    if (errors.domains) setErrors((prev) => ({ ...prev, domains: "" }));
  };

  const removeCustomDomain = (domainName: string) => {
    setFormData((prev) => ({
      ...prev,
      customDomains: prev.customDomains.filter((domain) => domain !== domainName),
    }));
  };

  const addCustomSkill = () => {
    const value = sanitizeCustomLabel(customSkillInput);
    if (!value) return;

    if (value.length < 2) {
      setErrors((prev) => ({ ...prev, skills: "Custom skill must be at least 2 characters" }));
      return;
    }

    if (formData.customSkills.length >= 5) {
      setErrors((prev) => ({ ...prev, skills: "You can add up to 5 custom skills" }));
      return;
    }

    const normalizedValue = value.toLowerCase();
    const duplicateInMaster = availableSkills.some(
      (skill) => skill.name.toLowerCase() === normalizedValue,
    );
    const duplicateInCustom = formData.customSkills.some(
      (skill) => skill.toLowerCase() === normalizedValue,
    );

    if (duplicateInMaster || duplicateInCustom) {
      setErrors((prev) => ({ ...prev, skills: "This skill already exists" }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      customSkills: [...prev.customSkills, value],
    }));
    setCustomSkillInput("");
    if (errors.skills) setErrors((prev) => ({ ...prev, skills: "" }));
  };

  const removeCustomSkill = (skillName: string) => {
    setFormData((prev) => ({
      ...prev,
      customSkills: prev.customSkills.filter((skill) => skill !== skillName),
    }));
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
    if (currentStep === 1) return "Choose Your Role";
    if (currentStep === 2) return "Complete Your Profile";
    if (currentStep === 3) return isStaffRole(formData.role) ? "Upload Your CV" : "Select Your Domains";
    if (currentStep === 4) return isStaffRole(formData.role) ? "Complete Manual KYC" : "Choose Your Skills";
    return "Sign Up";
  };

  const getStepSubtitle = () => {
    if (currentStep === 1) return "Tell us what brings you to our platform";
    if (currentStep === 2)
      return `You're signing up as ${formData.role ? getRoleLabel(formData.role) : "a user"}`;
    if (currentStep === 3)
      return isStaffRole(formData.role)
        ? "Upload your latest CV in PDF or DOCX format (max 5MB)"
        : "What industries/areas do you specialize in?";
    if (currentStep === 4)
      return isStaffRole(formData.role)
        ? "Enter your document details and upload the required images for manual review"
        : "What technologies/skills do you work with?";
    return "";
  };

  const stepLabels = getSignupStepLabels(formData.role);
  const totalSteps = stepLabels.length;

  const renderStep3Content = () => {
    if (isStaffRole(formData.role)) {
      return (
        <div className="space-y-4">
          <div
            style={{
              border: "1px solid var(--auth-border)",
              borderRadius: "16px",
              backgroundColor: "var(--auth-input-bg)",
              padding: "1rem",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--auth-text)",
                marginBottom: "0.5rem",
              }}
            >
              Upload CV <span style={{ color: "var(--auth-error)" }}>*</span>
            </label>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--auth-text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              Only PDF or DOCX files are accepted. Maximum file size is 5MB.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => handleFileChange("staffCv", event.target.files?.[0] || null)}
              style={{
                width: "100%",
                border: "1px solid var(--auth-border)",
                borderRadius: "12px",
                padding: "0.75rem",
                backgroundColor: "white",
                color: "var(--auth-text)",
              }}
            />
            {formData.staffCv && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "12px",
                  backgroundColor: "rgba(20, 184, 166, 0.08)",
                  color: "var(--auth-text)",
                  fontSize: "0.875rem",
                }}
              >
                <div style={{ fontWeight: 600 }}>{formData.staffCv.name}</div>
                <div style={{ color: "var(--auth-text-muted)", marginTop: "0.25rem" }}>
                  {(formData.staffCv.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            )}
            {errors.staffCv && (
              <p
                style={{
                  color: "var(--auth-error)",
                  fontSize: "0.875rem",
                  marginTop: "0.5rem",
                }}
              >
                {errors.staffCv}
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--auth-text)",
            marginBottom: "1rem",
          }}
        >
          Select domains you work in (choose at least 1)
        </label>
        {loadingDomains ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--auth-text-muted)",
            }}
          >
            Loading domains...
          </div>
        ) : availableDomains && availableDomains.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
            }}
          >
            {availableDomains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => toggleDomain(domain.id)}
                style={{
                  padding: "1rem",
                  border: `2px solid ${formData.domains.includes(domain.id) ? "var(--auth-primary)" : "var(--auth-border)"}`,
                  borderRadius: "12px",
                  backgroundColor: formData.domains.includes(domain.id)
                    ? "rgba(37, 99, 235, 0.05)"
                    : "var(--auth-input-bg)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {domain.icon && (
                  <div
                    style={{
                      fontSize: "1.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {domain.icon}
                  </div>
                )}
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--auth-text)",
                    fontSize: "0.875rem",
                  }}
                >
                  {domain.name}
                </div>
                {domain.description && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--auth-text-muted)",
                      marginTop: "0.25rem",
                    }}
                  >
                    {domain.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--auth-error)",
            }}
          >
            <p>No domains available. Please contact administrator.</p>
            <p
              style={{
                fontSize: "0.75rem",
                marginTop: "0.5rem",
                color: "var(--auth-text-muted)",
              }}
            >
              Database may need to be seeded with domain data.
            </p>
          </div>
        )}

        <div
          style={{
            marginTop: "1rem",
            border: "1px dashed var(--auth-border)",
            borderRadius: "12px",
            padding: "0.875rem",
            backgroundColor: "var(--auth-input-bg)",
          }}
        >
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--auth-text)",
              marginBottom: "0.5rem",
            }}
          >
            Can't find your domain? Add your own
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomDomain();
                }
              }}
              placeholder="Type custom domain..."
              style={{
                flex: 1,
                padding: "0.625rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--auth-border)",
                backgroundColor: "white",
                color: "var(--auth-text)",
                fontSize: "0.875rem",
              }}
            />
            <button
              type="button"
              onClick={addCustomDomain}
              style={{
                padding: "0.625rem 0.875rem",
                borderRadius: "8px",
                border: "1px solid var(--auth-primary)",
                color: "var(--auth-primary)",
                backgroundColor: "transparent",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>

          {formData.customDomains.length > 0 && (
            <div
              style={{
                marginTop: "0.625rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {formData.customDomains.map((domainName) => (
                <div
                  key={domainName}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    borderRadius: "999px",
                    border: "1px solid var(--auth-primary)",
                    color: "var(--auth-primary)",
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {domainName}
                  <button
                    type="button"
                    onClick={() => removeCustomDomain(domainName)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--auth-primary)",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 700,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {errors.domains && (
          <p
            style={{
              color: "var(--auth-error)",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
            }}
          >
            {errors.domains}
          </p>
        )}
      </div>
    );
  };

  const renderStep4Content = () => {
    if (isStaffRole(formData.role)) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              id="fullNameOnDocument"
              label="Full name on document"
              type="text"
              placeholder="Nguyen Van A"
              value={formData.fullNameOnDocument}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("fullNameOnDocument", e.target.value)
              }
              error={errors.fullNameOnDocument}
            />
            <Input
              id="documentType"
              label="Document type"
              type="text"
              value="Citizen ID"
              disabled
              readOnly
              error={errors.documentType}
            />
            <Input
              id="documentNumber"
              label="Document number"
              type="text"
              placeholder="001234567890"
              value={formData.documentNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("documentNumber", e.target.value)
              }
              error={errors.documentNumber}
            />
            <Input
              id="dateOfBirth"
              label="Date of birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("dateOfBirth", e.target.value)
              }
              error={errors.dateOfBirth}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--auth-text)",
              }}
            >
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              rows={3}
              placeholder="Current residential address"
              style={{
                width: "100%",
                borderRadius: "12px",
                border: `1px solid ${errors.address ? "var(--auth-error)" : "var(--auth-border)"}`,
                backgroundColor: "var(--auth-input-bg)",
                color: "var(--auth-text)",
                padding: "0.875rem",
                outline: "none",
              }}
            />
            {errors.address && (
              <p style={{ color: "var(--auth-error)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                {errors.address}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                field: "idCardFront",
                label: "ID card front",
                file: formData.idCardFront,
                error: errors.idCardFront,
              },
              {
                field: "idCardBack",
                label: "ID card back",
                file: formData.idCardBack,
                error: errors.idCardBack,
              },
              {
                field: "selfie",
                label: "Selfie",
                file: formData.selfie,
                error: errors.selfie,
              },
            ].map((item) => (
              <div
                key={item.field}
                style={{
                  border: "1px solid var(--auth-border)",
                  borderRadius: "16px",
                  backgroundColor: "var(--auth-input-bg)",
                  padding: "1rem",
                  minWidth: 0,
                }}
              >
                <label
                  htmlFor={`staff-kyc-${item.field}`}
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--auth-text)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {item.label}
                </label>
                <div
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: `1px solid ${item.error ? "var(--auth-error)" : "var(--auth-border)"}`,
                    borderRadius: "12px",
                    padding: "0.75rem",
                    backgroundColor: "white",
                    overflow: "hidden",
                  }}
                >
                  <input
                    id={`staff-kyc-${item.field}`}
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleFileChange(item.field, event.target.files?.[0] || null)
                    }
                    style={{ display: "none" }}
                  />
                  <label
                    htmlFor={`staff-kyc-${item.field}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      minHeight: "3rem",
                      padding: "0.625rem 0.5rem",
                      borderRadius: "10px",
                      border: "1px solid var(--auth-border)",
                      backgroundColor: "var(--auth-input-bg)",
                      color: "var(--auth-text)",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      overflow: "hidden",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    Choose image
                  </label>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: item.file ? "var(--auth-text-muted)" : "var(--auth-text-muted)",
                      marginTop: "0.5rem",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.file?.name || "No file selected"}
                  >
                    {item.file?.name || "No file selected"}
                  </p>
                </div>
                {item.error && (
                  <p
                    style={{
                      color: "var(--auth-error)",
                      fontSize: "0.75rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--auth-text)",
            marginBottom: "1rem",
          }}
        >
          Select your skills/technologies (choose at least 1)
        </label>
        {loadingSkills ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--auth-text-muted)",
            }}
          >
            Loading skills...
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {availableSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                style={{
                  padding: "0.5rem 1rem",
                  border: `2px solid ${formData.skills.includes(skill.id) ? "var(--auth-primary)" : "var(--auth-border)"}`,
                  borderRadius: "20px",
                  backgroundColor: formData.skills.includes(skill.id)
                    ? "var(--auth-primary)"
                    : "transparent",
                  color: formData.skills.includes(skill.id) ? "white" : "var(--auth-text)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {skill.name}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: "1rem",
            border: "1px dashed var(--auth-border)",
            borderRadius: "12px",
            padding: "0.875rem",
            backgroundColor: "var(--auth-input-bg)",
          }}
        >
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--auth-text)",
              marginBottom: "0.5rem",
            }}
          >
            Can't find your skill? Add your own
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSkill();
                }
              }}
              placeholder="Type custom skill..."
              style={{
                flex: 1,
                padding: "0.625rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--auth-border)",
                backgroundColor: "white",
                color: "var(--auth-text)",
                fontSize: "0.875rem",
              }}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              style={{
                padding: "0.625rem 0.875rem",
                borderRadius: "8px",
                border: "1px solid var(--auth-primary)",
                color: "var(--auth-primary)",
                backgroundColor: "transparent",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>

          {formData.customSkills.length > 0 && (
            <div
              style={{
                marginTop: "0.625rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {formData.customSkills.map((skillName) => (
                <div
                  key={skillName}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    borderRadius: "999px",
                    border: "1px solid var(--auth-primary)",
                    color: "var(--auth-primary)",
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {skillName}
                  <button
                    type="button"
                    onClick={() => removeCustomSkill(skillName)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--auth-primary)",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 700,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {errors.skills && (
          <p
            style={{
              color: "var(--auth-error)",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
            }}
          >
            {errors.skills}
          </p>
        )}
      </div>
    );
  };

  return (
    <AuthLayout title={getStepTitle()} subtitle={getStepSubtitle()}>
      {/* Progress Indicator */}
      <div style={{ marginBottom: "2rem" }}>
        {/* Progress bars */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {[...Array(totalSteps)].map((_, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                backgroundColor:
                  currentStep > idx ? "#14b8a6" : "var(--auth-border)",
                transition: "background-color 0.3s ease",
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${totalSteps}, 1fr)`,
            gap: "0.5rem",
          }}
        >
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isCompleted = currentStep > stepNumber;

            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor:
                      isActive || isCompleted ? "#14b8a6" : "var(--auth-border)",
                    color:
                      isActive || isCompleted ? "white" : "var(--auth-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    transition: "all 0.3s ease",
                  }}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#14b8a6" : "var(--auth-text-muted)",
                    textAlign: "center",
                    transition: "all 0.3s ease",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="space-y-6"
      >
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
                opacity: { duration: 0.2 },
              }}
            >
              {/* Role Selection */}
              <div>
                <label
                  htmlFor="role"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--auth-text)",
                  }}
                >
                  I am a...{" "}
                  <span style={{ color: "var(--auth-error)" }}>*</span>
                </label>
                <div className="space-y-3">
                  {(['client', 'broker', 'freelancer', 'staff'] as UserRole[]).map((role) => (
                    <motion.button
                      key={role}
                      type="button"
                      onClick={() => handleRoleSelect(role)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: "100%",
                        padding: "1rem",
                        borderRadius: "8px",
                        border: `2px solid ${formData.role === role ? "var(--auth-primary)" : "var(--auth-border)"}`,
                        backgroundColor:
                          formData.role === role
                            ? "rgba(37, 99, 235, 0.05)"
                            : "var(--auth-input-bg)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (formData.role !== role) {
                          e.currentTarget.style.borderColor =
                            "var(--auth-primary)";
                          e.currentTarget.style.backgroundColor =
                            "rgba(37, 99, 235, 0.02)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.role !== role) {
                          e.currentTarget.style.borderColor =
                            "var(--auth-border)";
                          e.currentTarget.style.backgroundColor =
                            "var(--auth-input-bg)";
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            backgroundColor:
                              formData.role === role
                                ? "var(--auth-primary)"
                                : "rgba(37, 99, 235, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {React.createElement(getRoleIcon(role), {
                            className: "w-6 h-6",
                            style: {
                              color:
                                formData.role === role
                                  ? "white"
                                  : "var(--auth-primary)",
                            },
                          })}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--auth-text)",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {getRoleLabel(role)}
                          </div>
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "var(--auth-text-muted)",
                            }}
                          >
                            {getRoleDescription(role)}
                          </div>
                        </div>
                        <ArrowRight
                          className="w-5 h-5"
                          style={{
                            color: "var(--auth-text-muted)",
                            opacity: formData.role === role ? 1 : 0.3,
                          }}
                        />
                      </div>
                    </motion.button>
                  ))}
                </div>
                {errors.role && (
                  <p
                    style={{
                      color: "var(--auth-error)",
                      fontSize: "0.875rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {errors.role}
                  </p>
                )}
              </div>

              <p
                className="text-center"
                style={{
                  color: "var(--auth-text-muted)",
                  fontSize: "0.875rem",
                  marginTop: "2rem",
                }}
              >
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToSignIn
                      ? onNavigateToSignIn()
                      : navigate(ROUTES.LOGIN)
                  }
                  className="hover:underline"
                  style={{ color: "var(--auth-primary)", fontWeight: 500 }}
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
                opacity: { duration: 0.2 },
              }}
            >
              {/* Back Button */}
              <button
                type="button"
                onClick={handleBackToRoleSelection}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                  color: "var(--auth-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.5rem 0",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange("fullName", e.target.value)
                }
                error={errors.fullName}
                required
              />

              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                error={errors.email}
                required
              />

              <Input
                id="phoneNumber"
                label="Phone Number"
                type="tel"
                placeholder="0987654321"
                value={formData.phoneNumber}
                onChange={(e) => handleChange("phoneNumber", e.target.value)}
                error={errors.phoneNumber}
                required
              />

              <div>
                <div className="relative">
                  <Input
                    id="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    hasTrailingAction
                    autoComplete="new-password"
                    placeholder="At least 8 characters with lowercase, number & special char"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange("password", e.target.value)
                    }
                    error={errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-11"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff
                        className="w-5 h-5"
                        style={{ color: "var(--auth-text-muted)" }}
                      />
                    ) : (
                      <Eye
                        className="w-5 h-5"
                        style={{ color: "var(--auth-text-muted)" }}
                      />
                    )}
                  </button>
                </div>
                <PasswordStrength password={formData.password} />
              </div>

              <div className="relative">
                <Input
                  id="confirmPassword"
                  label="Confirm password"
                  type={showConfirmPassword ? "text" : "password"}
                  hasTrailingAction
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange("confirmPassword", e.target.value)
                  }
                  error={errors.confirmPassword}
                  success={
                    !!(
                      formData.confirmPassword &&
                      formData.password === formData.confirmPassword &&
                      formData.confirmPassword.length >= 8
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-11"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff
                      className="w-5 h-5"
                      style={{ color: "var(--auth-text-muted)" }}
                    />
                  ) : (
                    <Eye
                      className="w-5 h-5"
                      style={{ color: "var(--auth-text-muted)" }}
                    />
                  )}
                </button>
              </div>

              {/* CAPTCHA Input */}
              <CaptchaInput
                onChange={(token) =>
                  handleChange("recaptchaToken", token || "")
                }
                error={errors.recaptcha}
              />

              <div style={{ marginBottom: "1.2rem" }}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.acceptTerms && formData.acceptPrivacy}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      handleChange("acceptTerms", checked);
                      handleChange("acceptPrivacy", checked);
                    }}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                    style={{
                      accentColor: "#14b8a6",
                    }}
                  />
                  <span
                    style={{ color: "var(--auth-text)", fontSize: "0.875rem" }}
                  >
                    I accept the{" "}
                    <a
                      href={ROUTES.LEGAL_TERMS}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline font-medium"
                      style={{ color: "#14b8a6" }}
                    >
                      Terms of Service
                    </a>
                    {" and "}
                    <a
                      href={ROUTES.LEGAL_PRIVACY}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline font-medium"
                      style={{ color: "#14b8a6" }}
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {(errors.acceptTerms || errors.acceptPrivacy) && (
                  <p
                    className="mt-1.5 text-sm"
                    style={{ color: "var(--auth-error)" }}
                  >
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
                {formData.role === "freelancer" ||
                formData.role === "broker" ||
                formData.role === "staff"
                  ? "Next"
                  : loading
                    ? "Creating account..."
                    : "Create Account"}
              </Button>

              <p
                className="text-center"
                style={{
                  color: "var(--auth-text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToSignIn
                      ? onNavigateToSignIn()
                      : navigate(ROUTES.LOGIN)
                  }
                  className="hover:underline"
                  style={{ color: "var(--auth-primary)", fontWeight: 500 }}
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
                opacity: { duration: 0.2 },
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                  color: "var(--auth-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.5rem 0",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to profile
              </button>
              {renderStep3Content()}

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
                opacity: { duration: 0.2 },
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                  color: "var(--auth-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.5rem 0",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {isStaffRole(formData.role) ? "CV upload" : "domains"}
              </button>
              {renderStep4Content()}

              <Button
                type="button"
                onClick={handleSkillsNext}
                variant="primary"
                className="w-full py-3 text-base font-medium justify-center mt-6"
                disabled={loading || !isStep4Valid()}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </AuthLayout>
  );
}

export default SignUpPage;
