import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Edit2, Shield, ExternalLink, FileText, Download, ArrowLeft, Briefcase, X, TrendingUp } from 'lucide-react';
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/features/auth/api";
import { STORAGE_KEYS } from "@/constants";
import { TrustScoreCard } from "@/features/trust-profile/components";
import type { BadgeType } from "@/features/trust-profile/types";

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
  currentTrustScore: number;
  skills?: string[];
  linkedinUrl?: string;
  cvUrl?: string;
  stats?: {
    finished: number;
    disputes: number;
    score: number;
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    bio: "",
  });

  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = (await getProfile()) as any;
      console.log("Profile response:", response.data);
      const userData = response.data || response.data?.data;
      setProfile(userData);
      setFormData({
        fullName: userData.fullName || "",
        phoneNumber: userData.phoneNumber || "",
        bio: userData.bio || "",
      });
      setAvatarPreview(userData.avatarUrl || "");
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile information");
    } finally {
      setLoading(false);
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
          "Large avatar size detected. Consider using cloud storage for production."
        );
      }

      await updateProfile({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        bio: formData.bio,
        avatarUrl,
      });

      toast.success("Profile updated successfully");
      setIsEditing(false);
      await loadProfile();

      // Update user data in localStorage to sync with Header
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      if (userStr) {
        const user = JSON.parse(userStr);
        user.fullName = formData.fullName;
        user.avatarUrl = avatarUrl;
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

        // Dispatch custom event to notify Header of the change
        window.dispatchEvent(new Event("userDataUpdated"));
      }
    } catch (error: any) {
      console.error("Failed to update profile:", error);
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
    });
    setAvatarPreview(profile?.avatarUrl || "");
    setAvatarFile(null);
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

  const handleViewCV = () => {
    if (!profile?.cvUrl) return;
    
    try {
      // Convert base64 to blob for better browser compatibility
      const base64Data = profile.cvUrl.split(',')[1];
      const mimeType = profile.cvUrl.split(',')[0].split(':')[1].split(';')[0];
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Create object URL and open in new tab
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error viewing CV:', error);
      toast.error('Failed to open CV. Try downloading instead.');
    }
  };

  const handleDownloadCV = () => {
    if (!profile?.cvUrl) return;
    
    try {
      // Convert base64 to blob
      const base64Data = profile.cvUrl.split(',')[1];
      const mimeType = profile.cvUrl.split(',')[0].split(':')[1].split(';')[0];
      
      // Determine file extension based on MIME type
      let extension = '.pdf';
      if (mimeType.includes('png')) extension = '.png';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `CV_${profile.fullName.replace(/\s+/g, '_')}${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success('CV downloaded successfully');
    } catch (error) {
      console.error('Error downloading CV:', error);
      toast.error('Failed to download CV');
    }
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
                  profile.role
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
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm break-all">{profile.email}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  {profile.phoneNumber || "Not updated"}
                </span>
              </div>

              {profile.bio && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
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
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Enter address or business information..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.bio.length}/500 ký tự
                </p>
              </div>

              {/* Account Stats - Thông tin thêm để fill chỗ trống */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  Account Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">
                        Account Type
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {getRoleDisplayName(profile.role)}
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">
                        Verification
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {profile.isVerified ? "Verified" : "Not Verified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Freelancer Documents - Only for Freelancer role */}
              {profile.role === 'FREELANCER' && (profile.cvUrl || profile.linkedinUrl || (profile.skills && profile.skills.length > 0)) && (
                <div className="border-t pt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Professional Information</h4>
                  
                  {/* Skills */}
                  {profile.skills && profile.skills.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LinkedIn */}
                  {profile.linkedinUrl && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Profile</label>
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

                  {/* CV Document */}
                  {profile.cvUrl && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Curriculum Vitae (CV)</p>
                            <p className="text-sm text-gray-600">Your professional resume</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDownloadCV}
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                          <button
                            onClick={handleViewCV}
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </div>
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
    </div>
  );
}
