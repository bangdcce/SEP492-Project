import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Edit2,
  Shield,
  ExternalLink,
  FileText,
  Download,
  ArrowLeft,
  Briefcase,
  X,
  TrendingUp,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  getProfile,
  getDisputeDevSettings,
  getSigningCredentialStatus,
  initializeSigningCredential,
  rotateSigningCredential,
  updateDisputeDevSettings,
  updateProfile,
  type DisputeDevSettingsSnapshot,
} from "@/features/auth/api";
import { CVUpload, SkillsDisplay } from "@/features/auth";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { TrustScoreCard } from "@/features/trust-profile/components";
import type { Certification } from "@/features/auth/types";
import type { BadgeType } from "@/features/trust-profile/types";
import { getStoredJson, setStoredJsonAuto } from "@/shared/utils/storage";
import { DeleteAccountModal } from "@/shared/components/auth/DeleteAccountModal";
import { apiClient } from "@/shared/api/client";
import { Switch } from "@/shared/components/ui/switch";

const MONTH_OPTIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const YEAR_OPTIONS = Array.from({ length: 51 }, (_, index) =>
  String(new Date().getFullYear() - index),
);

const createEmptyCertificateDraft = () => ({
  name: "",
  issuingOrganization: "",
  issueMonth: "",
  issueYear: "",
  credentialId: "",
  credentialUrl: "",
  expirationMonth: "",
  expirationYear: "",
});

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
  bio?: string;
  badge: BadgeType;
  isVerified: boolean;
  isEmailVerified?: boolean;
  currentTrustScore: number;
  skills?: string[];
  linkedinUrl?: string;
  cvUrl?: string;
  certifications?: Certification[];
  stats?: {
    finished: number;
    disputes: number;
    score: number;
  };
}

interface KycProfileSummary {
  status?: string;
  latestSubmissionStatus?: string;
  hasPendingUpdate?: boolean;
  hasRejectedUpdate?: boolean;
  updateSubmittedAt?: string;
  updateReviewedAt?: string;
  updateRejectionReason?: string;
  message?: string;
}

interface SigningCredentialStatus {
  initialized: boolean;
  keyFingerprint?: string;
  keyAlgorithm?: string;
  keyVersion?: number;
  lockedUntil?: string | null;
  rotatedAt?: string | null;
  createdAt?: string | null;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [kycSummary, setKycSummary] = useState<KycProfileSummary | null>(null);
  const [signingCredentialStatus, setSigningCredentialStatus] =
    useState<SigningCredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [securityActionBusy, setSecurityActionBusy] = useState(false);
  const [showInitializeSigningDialog, setShowInitializeSigningDialog] =
    useState(false);
  const [showRotateSigningDialog, setShowRotateSigningDialog] = useState(false);
  const [initializePinInput, setInitializePinInput] = useState("");
  const [rotatePinInput, setRotatePinInput] = useState({
    oldPin: "",
    newPin: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [disputeDevSettings, setDisputeDevSettings] =
    useState<DisputeDevSettingsSnapshot | null>(null);
  const [disputeDevSettingsLoading, setDisputeDevSettingsLoading] =
    useState(false);
  const [disputeDevSettingsSaving, setDisputeDevSettingsSaving] =
    useState(false);
  const [disputeDevTargetEmail, setDisputeDevTargetEmail] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    bio: "",
    certifications: [] as Certification[],
  });
  const [certificateForm, setCertificateForm] = useState(
    createEmptyCertificateDraft,
  );

  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const normalizeCertifications = (
    certifications: unknown,
  ): Certification[] => {
    if (!Array.isArray(certifications)) return [];

    return certifications
      .map((item: any, index: number) => {
        if (!item || typeof item !== "object") return null;

        return {
          id: item.id || `cert-${Date.now()}-${index}`,
          name: item.name || "",
          issuingOrganization: item.issuingOrganization || "",
          issueMonth: item.issueMonth || "",
          issueYear: item.issueYear || "",
          credentialId: item.credentialId || "",
          credentialUrl: item.credentialUrl || "",
          expirationMonth: item.expirationMonth || "",
          expirationYear: item.expirationYear || "",
        } as Certification;
      })
      .filter((item): item is Certification => {
        return Boolean(
          item &&
          item.name &&
          item.issuingOrganization &&
          item.issueMonth &&
          item.issueYear &&
          item.credentialUrl,
        );
      });
  };

  const isValidHttpUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = (await getProfile()) as any;
      const userData = response.data || response.data?.data;
      const certifications = normalizeCertifications(userData.certifications);
      const normalizedProfile = {
        ...userData,
        certifications,
      };

      setProfile(normalizedProfile);
      setFormData({
        fullName: userData.fullName || "",
        phoneNumber: userData.phoneNumber || "",
        bio: userData.bio || "",
        certifications,
      });
      setAvatarPreview(userData.avatarUrl || "");

      // Keep header avatar/name in sync with latest profile
      const user = getStoredJson<any>(STORAGE_KEYS.USER);
      if (user) {
        user.fullName = userData.fullName || user.fullName;
        user.avatarUrl = userData.avatarUrl || "";
        setStoredJsonAuto(STORAGE_KEYS.USER, user);
        window.dispatchEvent(new Event("userDataUpdated"));
      }
    } catch {
      toast.error("Failed to load profile information");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKycSummary = useCallback(async () => {
    try {
      const data = await apiClient.get<KycProfileSummary>("/kyc/me");
      setKycSummary(data);
    } catch {
      setKycSummary(null);
    }
  }, []);

  const loadSigningCredentialStatus = useCallback(async () => {
    try {
      const status = await getSigningCredentialStatus();
      setSigningCredentialStatus(status);
    } catch {
      setSigningCredentialStatus(null);
    }
  }, []);

  const loadDisputeDevSettings = useCallback(async (fallbackEmail?: string) => {
    try {
      setDisputeDevSettingsLoading(true);
      const settings = await getDisputeDevSettings();
      setDisputeDevSettings(settings);
      setDisputeDevTargetEmail(
        settings.activePinnedStaff?.email || fallbackEmail || "",
      );
    } catch {
      setDisputeDevSettings(null);
      setDisputeDevTargetEmail(fallbackEmail || "");
    } finally {
      setDisputeDevSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadKycSummary();
    loadSigningCredentialStatus();
  }, [loadProfile, loadKycSummary, loadSigningCredentialStatus]);

  useEffect(() => {
    if (!profile || !["STAFF", "ADMIN"].includes(profile.role)) {
      setDisputeDevSettings(null);
      setDisputeDevTargetEmail("");
      return;
    }

    void loadDisputeDevSettings(profile.email);
  }, [loadDisputeDevSettings, profile]);

  const normalizePinInput = (value: string) =>
    value.replace(/\D/g, "").slice(0, 8);
  const isValidSigningPin = (value: string) => /^\d{4,8}$/.test(value.trim());

  const handleInitializeSigningCredential = async () => {
    const pin = initializePinInput.trim();
    if (!isValidSigningPin(pin)) {
      toast.error("PIN must be 4 to 8 numeric digits");
      return;
    }

    try {
      setSecurityActionBusy(true);
      await initializeSigningCredential(pin);
      await loadSigningCredentialStatus();
      setInitializePinInput("");
      setShowInitializeSigningDialog(false);
      toast.success("Mini CA signing key initialized");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to initialize signing key",
      );
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleRotateSigningCredential = async () => {
    const oldPin = rotatePinInput.oldPin.trim();
    const newPin = rotatePinInput.newPin.trim();

    if (!isValidSigningPin(oldPin)) {
      toast.error("Current PIN must be 4 to 8 numeric digits");
      return;
    }

    if (!isValidSigningPin(newPin)) {
      toast.error("New PIN must be 4 to 8 numeric digits");
      return;
    }

    try {
      setSecurityActionBusy(true);
      await rotateSigningCredential(oldPin, newPin);
      await loadSigningCredentialStatus();
      setRotatePinInput({ oldPin: "", newPin: "" });
      setShowRotateSigningDialog(false);
      toast.success("Mini CA signing key rotated successfully");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to rotate signing key",
      );
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must not exceed 5MB");
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const avatarUrl = avatarFile ? avatarPreview : profile?.avatarUrl;

      // Warning about base64 - should use cloud storage in production
      if (avatarFile && avatarPreview.length > 100000) {
        toast.warning(
          "Large avatar size detected. Consider using cloud storage for production.",
        );
      }

      await updateProfile({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        bio: formData.bio,
        avatarUrl,
        certifications: formData.certifications.map((item) => ({
          name: item.name.trim(),
          issuingOrganization: item.issuingOrganization.trim(),
          issueMonth: item.issueMonth,
          issueYear: item.issueYear,
          credentialUrl: item.credentialUrl.trim(),
          ...(item.credentialId?.trim()
            ? { credentialId: item.credentialId.trim() }
            : {}),
          ...(item.expirationMonth
            ? { expirationMonth: item.expirationMonth }
            : {}),
          ...(item.expirationYear
            ? { expirationYear: item.expirationYear }
            : {}),
        })),
      });

      toast.success("Profile updated successfully");
      setIsEditing(false);
      await Promise.all([loadProfile(), loadKycSummary()]);

      // Update user data in storage to sync with Header
      const user = getStoredJson<any>(STORAGE_KEYS.USER);
      if (user) {
        user.fullName = formData.fullName;
        user.avatarUrl = avatarUrl;
        setStoredJsonAuto(STORAGE_KEYS.USER, user);

        // Dispatch custom event to notify Header of the change
        window.dispatchEvent(new Event("userDataUpdated"));
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      fullName: profile?.fullName || "",
      phoneNumber: profile?.phoneNumber || "",
      bio: profile?.bio || "",
      certifications: profile?.certifications || [],
    });
    setAvatarPreview(profile?.avatarUrl || "");
    setAvatarFile(null);
    setCertificateForm(createEmptyCertificateDraft());
  };

  const persistDisputeDevSettings = useCallback(
    async (enabled: boolean, targetStaffEmail?: string) => {
      try {
        setDisputeDevSettingsSaving(true);
        const nextSettings = await updateDisputeDevSettings(
          enabled,
          targetStaffEmail,
        );
        setDisputeDevSettings(nextSettings);
        setDisputeDevTargetEmail(
          nextSettings.activePinnedStaff?.email ||
            targetStaffEmail ||
            profile?.email ||
            "",
        );
        toast.success(
          enabled
            ? `Dev auto-assign is now pinned to ${nextSettings.activePinnedStaff?.email || targetStaffEmail}.`
            : "Dev auto-assign pin cleared.",
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            "Failed to update dispute dev settings",
        );
      } finally {
        setDisputeDevSettingsSaving(false);
      }
    },
    [profile?.email],
  );

  const handleDisputeDevModeToggle = async (enabled: boolean) => {
    const normalizedEmail = disputeDevTargetEmail.trim().toLowerCase();
    if (enabled && !normalizedEmail) {
      toast.error("Enter the staff email that should receive dev auto-assign.");
      return;
    }

    await persistDisputeDevSettings(enabled, normalizedEmail || undefined);
  };

  const handleApplyDisputeDevTarget = async () => {
    const normalizedEmail = disputeDevTargetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter the staff email that should receive dev auto-assign.");
      return;
    }

    await persistDisputeDevSettings(true, normalizedEmail);
  };

  const handleAddCertificate = () => {
    const name = certificateForm.name.trim();
    const issuingOrganization = certificateForm.issuingOrganization.trim();
    const credentialUrl = certificateForm.credentialUrl.trim();

    if (
      !name ||
      !issuingOrganization ||
      !certificateForm.issueMonth ||
      !certificateForm.issueYear ||
      !credentialUrl
    ) {
      toast.error(
        "Please complete certificate name, organization, issue date, and credential URL",
      );
      return;
    }

    if (!isValidHttpUrl(credentialUrl)) {
      toast.error("Credential URL must be a valid http/https link");
      return;
    }

    const certificate: Certification = {
      id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      issuingOrganization,
      issueMonth: certificateForm.issueMonth,
      issueYear: certificateForm.issueYear,
      credentialUrl,
      ...(certificateForm.credentialId.trim()
        ? { credentialId: certificateForm.credentialId.trim() }
        : {}),
      ...(certificateForm.expirationMonth
        ? { expirationMonth: certificateForm.expirationMonth }
        : {}),
      ...(certificateForm.expirationYear
        ? { expirationYear: certificateForm.expirationYear }
        : {}),
    };

    setFormData((prev) => ({
      ...prev,
      certifications: [...prev.certifications, certificate],
    }));
    setCertificateForm(createEmptyCertificateDraft());
  };

  const handleRemoveCertificate = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((item) => item.id !== id),
    }));
  };

  const openCredential = (credentialUrl: string) => {
    window.open(credentialUrl, "_blank", "noopener,noreferrer");
  };

  const certificationsToRender = isEditing
    ? formData.certifications
    : profile?.certifications || [];

  const formatMonthYear = (month?: string, year?: string) => {
    if (month && year) return `${month} ${year}`;
    if (year) return year;
    if (month) return month;
    return "Not provided";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeStyle = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN: "bg-purple-100 text-purple-700",
      CLIENT: "bg-blue-100 text-blue-700",
      SME: "bg-blue-100 text-blue-700",
      FREELANCER: "bg-green-100 text-green-700",
      BROKER: "bg-orange-100 text-orange-700",
    };
    return styles[role?.toUpperCase()] || "bg-gray-100 text-gray-700";
  };

  const getRoleDisplayName = (role: string) => {
    const names: Record<string, string> = {
      ADMIN: "Administrator",
      CLIENT: "SME Client",
      SME: "SME Client",
      FREELANCER: "Freelancer",
      BROKER: "Broker",
    };
    return names[role?.toUpperCase()] || role;
  };

  const getRoleSummary = (role: string) => {
    const summaries: Record<string, string> = {
      ADMIN:
        "You manage platform operations, compliance flows, and system-wide configurations.",
      CLIENT:
        "You can create requests, manage projects, and collaborate with brokers or freelancers.",
      SME: "You can create requests, manage projects, and collaborate with brokers or freelancers.",
      FREELANCER:
        "You can showcase skills, submit proposals, and deliver work across active projects.",
      BROKER:
        "You can connect clients with talent, coordinate delivery, and support project matching.",
    };

    return (
      summaries[role?.toUpperCase()] ||
      "Your account role defines the workflows and tools available to you on the platform."
    );
  };

  const formatTrustScore = (value: unknown) => {
    const numericValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    return Number.isFinite(numericValue) ? numericValue.toFixed(1) : "0.0";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Profile not found</div>
      </div>
    );
  }

  const supportsKycUpdates = ["CLIENT", "FREELANCER", "BROKER"].includes(
    profile.role,
  );
  const hasPendingKycUpdate = !!kycSummary?.hasPendingUpdate;
  const hasRejectedKycUpdate = !!kycSummary?.hasRejectedUpdate;
  const supportsDisputeDevMode = ["STAFF", "ADMIN"].includes(profile.role);
  const updateSubmittedLabel = kycSummary?.updateSubmittedAt
    ? new Date(kycSummary.updateSubmittedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Back button */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-blue-500 flex items-center justify-center text-white text-5xl font-bold border-4 border-white shadow-lg">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(profile.fullName)
                  )}
                </div>

                {/* Camera icon for upload when editing */}
                {isEditing && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-2 right-2 bg-blue-600 text-white p-3 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Name */}
              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                {profile.fullName}
              </h2>

              {/* Role Badge */}
              <div
                className={`mt-2 px-4 py-1.5 rounded-full flex items-center gap-2 ${getRoleBadgeStyle(
                  profile.role,
                )}`}
              >
                <Briefcase className="w-4 h-4" />
                <span className="font-medium">
                  {getRoleDisplayName(profile.role)}
                </span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="w-5 h-5 shrink-0" />
                <span className="text-sm break-all">{profile.email}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="w-5 h-5 shrink-0" />
                <span className="text-sm">
                  {profile.phoneNumber || "Not updated"}
                </span>
              </div>

              {profile.bio && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-sm">{profile.bio}</span>
                </div>
              )}
            </div>

            {/* Trust Score Card - Using TrustScoreCard component */}
            <div className="mt-6">
              <TrustScoreCard
                user={{
                  id: profile.id,
                  fullName: profile.fullName,
                  avatarUrl: profile.avatarUrl || "",
                  isVerified: profile.isVerified,
                  isEmailVerified: profile.isEmailVerified,
                  currentTrustScore: profile.currentTrustScore,
                  badge: profile.badge,
                  stats: profile.stats || {
                    finished: 0,
                    disputes: 0,
                    score: profile.currentTrustScore,
                  },
                }}
              />
            </div>

            {/* Edit Button */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Edit2 className="w-5 h-5" />
                Edit Profile
              </button>
            )}

            {/* Delete Account Button */}
            {!isEditing && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full mt-3 bg-white hover:bg-red-50 text-red-600 border border-red-300 font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Delete Account
              </button>
            )}
          </div>
        </div>

        {/* Right Column - Profile Details Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Profile Details
              </h3>
              {isEditing && (
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  disabled={!isEditing}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  required
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  disabled={!isEditing}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              {/* Business Information */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  Business Information
                </h4>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address / Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  disabled={!isEditing}
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Enter address or business information..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.bio.length}/1000 characters
                </p>
              </div>

              {/* Account Stats - Thông tin thêm để fill chỗ trống */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  Account Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  <div className="h-full rounded-lg bg-blue-50 p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">
                        Account Type
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {getRoleDisplayName(profile.role)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {getRoleSummary(profile.role)}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-blue-700">
                        Trust score:{" "}
                        {formatTrustScore(profile.currentTrustScore)}
                      </div>
                    </div>
                  </div>

                  <div className="h-full rounded-lg bg-green-50 p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">
                        KYC Verification
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {profile.isVerified ? "KYC Verified" : "KYC Unverified"}
                    </p>
                    {!supportsKycUpdates && (
                      <p className="mt-3 text-sm leading-6 text-gray-600">
                        Your verification status is managed by the platform and
                        reflected across protected workflows.
                      </p>
                    )}
                    {supportsKycUpdates && profile.isVerified && (
                      <div className="mt-3 space-y-2">
                        <p
                          className={`text-xs ${
                            hasPendingKycUpdate
                              ? "text-amber-700"
                              : hasRejectedKycUpdate
                                ? "text-red-700"
                                : "text-gray-600"
                          }`}
                        >
                          {hasPendingKycUpdate
                            ? `A KYC update submitted${updateSubmittedLabel ? ` on ${updateSubmittedLabel}` : ""} is under review. Your current verification remains active.`
                            : hasRejectedKycUpdate
                              ? "Your latest KYC update was rejected. Your current verification still remains active."
                              : "Need to replace an ID document or correct your identity details? Submit a new KYC package for review."}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `${ROUTES.KYC_VERIFICATION}?mode=update&from=profile`,
                            )
                          }
                          disabled={hasPendingKycUpdate}
                          className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {hasPendingKycUpdate
                            ? "KYC Update In Review"
                            : hasRejectedKycUpdate
                              ? "Submit KYC Update Again"
                              : "Update KYC"}
                        </button>
                      </div>
                    )}
                    {supportsKycUpdates && !profile.isVerified && (
                      <div className="mt-3">
                        <p className="text-sm leading-6 text-gray-600">
                          Complete KYC verification to unlock protected
                          workflows and build trust with other users.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`${ROUTES.KYC_VERIFICATION}?from=profile`)
                          }
                          className="mt-3 w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                        >
                          Start KYC Verification
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  Contract Signing Security
                </h4>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Mini CA Credential
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {signingCredentialStatus?.initialized
                          ? "Initialized. Contract signatures now use your personal keypair and PIN unlock."
                          : "Not initialized yet. Initialize once before signing contracts with Mini CA."}
                      </p>
                      {signingCredentialStatus?.initialized && (
                        <div className="mt-3 space-y-1 text-xs text-gray-600">
                          <p>
                            Algorithm:{" "}
                            {signingCredentialStatus.keyAlgorithm || "N/A"} |
                            Version:{" "}
                            {signingCredentialStatus.keyVersion ?? "N/A"}
                          </p>
                          <p>
                            Fingerprint:{" "}
                            {signingCredentialStatus.keyFingerprint || "N/A"}
                          </p>
                          <p>
                            Locked until:{" "}
                            {signingCredentialStatus.lockedUntil
                              ? new Date(
                                  signingCredentialStatus.lockedUntil,
                                ).toLocaleString()
                              : "Not locked"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!signingCredentialStatus?.initialized ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInitializePinInput("");
                            setShowInitializeSigningDialog(true);
                          }}
                          disabled={securityActionBusy}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {securityActionBusy
                            ? "Initializing..."
                            : "Initialize Mini CA Key"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRotatePinInput({ oldPin: "", newPin: "" });
                            setShowRotateSigningDialog(true);
                          }}
                          disabled={securityActionBusy}
                          className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {securityActionBusy ? "Rotating..." : "Rotate Key"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {supportsDisputeDevMode && (
                <div className="border-t pt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">
                    Dispute Dev Mode
                  </h4>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Pin dispute auto-assign in dev/test
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            When enabled, new dispute auto-assignment runs will
                            be pinned to the staff email below instead of normal
                            balancing.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              disputeDevSettings?.enabled
                                ? "bg-purple-200 text-purple-900"
                                : "bg-white text-gray-600"
                            }`}
                          >
                            {disputeDevSettings?.enabled ? "Enabled" : "Off"}
                          </span>
                          <Switch
                            checked={disputeDevSettings?.enabled ?? false}
                            onCheckedChange={(checked) => {
                              void handleDisputeDevModeToggle(checked);
                            }}
                            disabled={
                              disputeDevSettingsLoading ||
                              disputeDevSettingsSaving ||
                              !disputeDevSettings?.testModeEnabled
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Staff email to receive dev auto-assign
                          </label>
                          <input
                            type="email"
                            value={disputeDevTargetEmail}
                            onChange={(event) =>
                              setDisputeDevTargetEmail(event.target.value)
                            }
                            disabled={
                              disputeDevSettingsLoading ||
                              disputeDevSettingsSaving ||
                              !disputeDevSettings?.testModeEnabled
                            }
                            placeholder="staff.test.new@example.com"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleApplyDisputeDevTarget();
                          }}
                          disabled={
                            disputeDevSettingsLoading ||
                            disputeDevSettingsSaving ||
                            !disputeDevSettings?.testModeEnabled ||
                            !disputeDevTargetEmail.trim()
                          }
                          className="self-end rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {disputeDevSettingsSaving ? "Applying..." : "Apply Target"}
                        </button>
                      </div>

                      <div className="space-y-1 text-xs text-gray-600">
                        <p>
                          Active pinned staff:{" "}
                          <span className="font-medium text-gray-900">
                            {disputeDevSettings?.activePinnedStaff
                              ? `${disputeDevSettings.activePinnedStaff.fullName} (${disputeDevSettings.activePinnedStaff.email})`
                              : "No staff pin is active"}
                          </span>
                        </p>
                        {disputeDevSettings?.source === "ENV" &&
                          disputeDevSettings.fallbackEmails.length > 0 && (
                            <p>
                              Server fallback:{" "}
                              {disputeDevSettings.fallbackEmails.join(", ")}
                            </p>
                          )}
                        {disputeDevSettings &&
                          !disputeDevSettings.testModeEnabled && (
                          <p className="text-amber-700">
                            Backend test mode is currently off. Turn on
                            `DISPUTE_TEST_MODE=true` in a non-production
                            environment before using this switch.
                          </p>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Professional Information - For Freelancer and Broker */}
              {["FREELANCER", "BROKER"].includes(profile.role) && (
                <div className="border-t pt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">
                    Professional Information
                  </h4>

                  {/* CV Section */}
                  {isEditing ? (
                    <CVUpload
                      currentCvUrl={profile.cvUrl}
                      onCVUpdated={loadProfile}
                    />
                  ) : (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CV/Resume
                      </label>
                      {profile.cvUrl ? (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-gray-700 flex-1">
                            CV uploaded
                          </span>
                          <div className="flex gap-2">
                            <a
                              href={profile.cvUrl}
                              download
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Download CV"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                            <a
                              href={profile.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="View CV"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-500">
                            No CV uploaded
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Certificates Section */}
                  <div className="mt-6 border-t pt-6">
                    <h5 className="text-base font-semibold text-gray-900 mb-1">
                      Licenses & Certifications
                    </h5>
                    <p className="text-sm text-gray-500 mb-4">
                      Add certifications so clients can verify your credentials.
                    </p>

                    {isEditing && (
                      <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={certificateForm.name}
                              onChange={(e) =>
                                setCertificateForm((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Ex: IBM Business Analyst"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Issuing Organization{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={certificateForm.issuingOrganization}
                              onChange={(e) =>
                                setCertificateForm((prev) => ({
                                  ...prev,
                                  issuingOrganization: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Ex: IBM"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Issue Date <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={certificateForm.issueMonth}
                                onChange={(e) =>
                                  setCertificateForm((prev) => ({
                                    ...prev,
                                    issueMonth: e.target.value,
                                  }))
                                }
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Month</option>
                                {MONTH_OPTIONS.map((month) => (
                                  <option key={month} value={month}>
                                    {month}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={certificateForm.issueYear}
                                onChange={(e) =>
                                  setCertificateForm((prev) => ({
                                    ...prev,
                                    issueYear: e.target.value,
                                  }))
                                }
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Year</option>
                                {YEAR_OPTIONS.map((year) => (
                                  <option key={year} value={year}>
                                    {year}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Credential ID
                            </label>
                            <input
                              type="text"
                              value={certificateForm.credentialId}
                              onChange={(e) =>
                                setCertificateForm((prev) => ({
                                  ...prev,
                                  credentialId: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Ex: R3N2OL4NM58R"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Expiration Date
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={certificateForm.expirationMonth}
                                onChange={(e) =>
                                  setCertificateForm((prev) => ({
                                    ...prev,
                                    expirationMonth: e.target.value,
                                  }))
                                }
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Month</option>
                                {MONTH_OPTIONS.map((month) => (
                                  <option key={month} value={month}>
                                    {month}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={certificateForm.expirationYear}
                                onChange={(e) =>
                                  setCertificateForm((prev) => ({
                                    ...prev,
                                    expirationYear: e.target.value,
                                  }))
                                }
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Year</option>
                                {YEAR_OPTIONS.map((year) => (
                                  <option key={year} value={year}>
                                    {year}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Credential URL{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="url"
                              value={certificateForm.credentialUrl}
                              onChange={(e) =>
                                setCertificateForm((prev) => ({
                                  ...prev,
                                  credentialUrl: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="https://..."
                            />
                          </div>

                          <div className="md:col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={handleAddCertificate}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Add certificate
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {certificationsToRender.length > 0 ? (
                      <div className="space-y-3">
                        {certificationsToRender.map((item, index) => (
                          <div
                            key={
                              item.id ||
                              `${item.name}-${item.issueYear}-${index}`
                            }
                            className="p-4 border border-gray-200 rounded-lg bg-white"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {item.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {item.issuingOrganization}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  Issued{" "}
                                  {formatMonthYear(
                                    item.issueMonth,
                                    item.issueYear,
                                  )}
                                </p>
                                {(item.expirationMonth ||
                                  item.expirationYear) && (
                                  <p className="text-sm text-gray-500">
                                    Expires{" "}
                                    {formatMonthYear(
                                      item.expirationMonth,
                                      item.expirationYear,
                                    )}
                                  </p>
                                )}
                                {item.credentialId && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    Credential ID: {item.credentialId}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCredential(item.credentialUrl)
                                  }
                                  className="inline-flex items-center gap-2 px-3 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Show credential
                                </button>

                                {isEditing && item.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveCertificate(item.id as string)
                                    }
                                    className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500">
                          No certificates added yet.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Skills Display */}
                  <SkillsDisplay
                    isEditing={isEditing}
                    userRole={profile.role}
                  />

                  {/* LinkedIn */}
                  {profile.linkedinUrl && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        LinkedIn Profile
                      </label>
                      <a
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userEmail={profile?.email || ""}
      />

      <Dialog
        open={showInitializeSigningDialog}
        onOpenChange={(open) => {
          if (securityActionBusy) {
            return;
          }
          setShowInitializeSigningDialog(open);
          if (!open) {
            setInitializePinInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialize Mini CA key</DialogTitle>
            <DialogDescription>
              Create a 4-8 digit PIN to encrypt and unlock your signing private
              key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="mini-ca-init-pin" className="text-sm text-gray-700">
              Signing PIN
            </label>
            <input
              id="mini-ca-init-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={initializePinInput}
              onChange={(event) => {
                setInitializePinInput(normalizePinInput(event.target.value));
              }}
              placeholder="4-8 digits"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowInitializeSigningDialog(false)}
              disabled={securityActionBusy}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleInitializeSigningCredential();
              }}
              disabled={
                securityActionBusy || initializePinInput.trim().length < 4
              }
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {securityActionBusy ? "Initializing..." : "Initialize key"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRotateSigningDialog}
        onOpenChange={(open) => {
          if (securityActionBusy) {
            return;
          }
          setShowRotateSigningDialog(open);
          if (!open) {
            setRotatePinInput({ oldPin: "", newPin: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Mini CA key</DialogTitle>
            <DialogDescription>
              Enter your current PIN and a new PIN to rotate your signing
              keypair.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="mini-ca-old-pin"
                className="text-sm text-gray-700"
              >
                Current PIN
              </label>
              <input
                id="mini-ca-old-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={rotatePinInput.oldPin}
                onChange={(event) => {
                  setRotatePinInput((prev) => ({
                    ...prev,
                    oldPin: normalizePinInput(event.target.value),
                  }));
                }}
                placeholder="4-8 digits"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="mini-ca-new-pin"
                className="text-sm text-gray-700"
              >
                New PIN
              </label>
              <input
                id="mini-ca-new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={rotatePinInput.newPin}
                onChange={(event) => {
                  setRotatePinInput((prev) => ({
                    ...prev,
                    newPin: normalizePinInput(event.target.value),
                  }));
                }}
                placeholder="4-8 digits"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowRotateSigningDialog(false)}
              disabled={securityActionBusy}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleRotateSigningCredential();
              }}
              disabled={
                securityActionBusy ||
                rotatePinInput.oldPin.trim().length < 4 ||
                rotatePinInput.newPin.trim().length < 4
              }
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {securityActionBusy ? "Rotating..." : "Rotate key"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
