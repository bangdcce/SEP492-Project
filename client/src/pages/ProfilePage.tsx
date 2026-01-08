import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Mail, Phone, Briefcase, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/custom/input';
import { getProfile, updateProfile } from '@/features/auth/api';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
  bio?: string;
  badge: string;
  isVerified: boolean;
  currentTrustScore: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
  });
  
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await getProfile() as any;
      console.log('Profile response:', response.data);
      const userData = response.data || response.data?.data;
      setProfile(userData);
      setFormData({
        fullName: userData.fullName || '',
        phoneNumber: userData.phoneNumber || '',
        bio: userData.bio || '',
      });
      setAvatarPreview(userData.avatarUrl || '');
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      toast.error('Không thể tải thông tin profile');
      if (error.response?.status === 401) {
        toast.error('Bạn cần đăng nhập để xem trang này');
        setTimeout(() => {
          navigate(ROUTES.LOGIN);
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
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

      // TODO: Upload avatar to cloud storage (Cloudinary/S3) and get URL
      // For now, we'll just use the preview as placeholder
      const avatarUrl = avatarFile ? avatarPreview : profile?.avatarUrl;

      await updateProfile({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        bio: formData.bio,
        avatarUrl,
      });

      toast.success('Cập nhật thông tin thành công');
      setIsEditing(false);
      await loadProfile();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const errorMessage = error.response?.data?.message || 'Không thể cập nhật thông tin';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      fullName: profile?.fullName || '',
      phoneNumber: profile?.phoneNumber || '',
      bio: profile?.bio || '',
    });
    setAvatarPreview(profile?.avatarUrl || '');
    setAvatarFile(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Đang tải...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Không tìm thấy thông tin profile</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Thông tin cá nhân</h1>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="default">
              Chỉnh sửa
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-400" />
                )}
              </div>
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700"
                >
                  <Camera className="w-5 h-5" />
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
            <div className="mt-4 text-center">
              <h2 className="text-xl font-semibold">{profile.fullName}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {profile.badge}
                </span>
                {profile.isVerified && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Input
                label="Email"
                type="email"
                value={profile.email}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Input
                label="Họ và tên"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>

            <div>
              <Input
                label="Số điện thoại"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? 'bg-gray-50' : ''}
              />
            </div>

            <div>
              <Input
                label="Vai trò"
                type="text"
                value={profile.role}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giới thiệu bản thân
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
                rows={4}
                maxLength={500}
                className={`w-full px-3 py-2 border rounded-md ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
                placeholder="Viết vài dòng về bản thân..."
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.bio.length}/500 ký tự
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium mb-2">Điểm uy tín</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(Number(profile.currentTrustScore || 0) / 5) * 100}%` }}
                  />
                </div>
                <span className="font-semibold">{Number(profile.currentTrustScore || 0).toFixed(1)}/5.0</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 mt-6">
              <Button
                type="submit"
                variant="default"
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
