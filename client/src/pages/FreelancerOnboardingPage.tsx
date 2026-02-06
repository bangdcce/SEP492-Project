import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, X, Link as LinkIcon, Award, Code, Save, Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/custom/input';
import { getProfile, updateProfile } from '@/features/auth/api';
import { ROUTES } from '@/constants';
import type { PortfolioLink } from '@/features/auth/types';



interface FreelancerProfile {
  skills: string[];
  portfolioLinks: PortfolioLink[];
  bio: string;
  companyName?: string;
  linkedinUrl?: string;
  cvUrl?: string;
}

export default function FreelancerOnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<FreelancerProfile>({
    skills: [],
    portfolioLinks: [],
    bio: '',
    companyName: '',
    linkedinUrl: '',
    cvUrl: '',
  });

  // Temporary states for adding new items
  const [newSkill, setNewSkill] = useState('');
  const [newPortfolio, setNewPortfolio] = useState<PortfolioLink>({ title: '', url: '' });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvPreview, setCvPreview] = useState<string>('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await getProfile();
      // Safely access data, using optional chaining and type assertion if needed for the response structure
      // Assuming response has data property which contains the user profile
      const userData = (response as any).data || (response as any).data?.data || response;
      
      setProfile({
        skills: userData.skills || [],
        portfolioLinks: userData.portfolioLinks || [],
        bio: userData.bio || '',
        companyName: userData.companyName || '',
        linkedinUrl: userData.linkedinUrl || '',
        cvUrl: userData.cvUrl || '',
      });
      
      if (userData.cvUrl) {
        setCvPreview(userData.cvUrl);
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkill.trim()) {
      toast.error('Please enter a skill');
      return;
    }

    if (profile.skills.includes(newSkill.trim())) {
      toast.error('This skill already exists');
      return;
    }

    setProfile(prev => ({
      ...prev,
      skills: [...prev.skills, newSkill.trim()],
    }));
    setNewSkill('');
    toast.success('Skill added');
  };

  const handleRemoveSkill = (index: number) => {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
    toast.success('Skill removed');
  };

  const handleAddPortfolio = () => {
    if (!newPortfolio.title.trim() || !newPortfolio.url.trim()) {
      toast.error('Please fill in both title and URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(newPortfolio.url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setProfile(prev => ({
      ...prev,
      portfolioLinks: [...prev.portfolioLinks, { ...newPortfolio }],
    }));
    setNewPortfolio({ title: '', url: '' });
    toast.success('Portfolio link added');
  };

  const handleRemovePortfolio = (index: number) => {
    setProfile(prev => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.filter((_, i) => i !== index),
    }));
    toast.success('Portfolio link removed');
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept PDF and images
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF, PNG, JPG, or JPEG file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must not exceed 5MB');
      return;
    }

    setCvFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCvPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    toast.success('CV uploaded successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profile.skills.length === 0 && !profile.linkedinUrl && !cvFile && !profile.cvUrl) {
      toast.error('Please add skills, LinkedIn URL, or upload CV');
      return;
    }

    try {
      setSaving(true);

      const cvUrl = cvFile ? cvPreview : profile.cvUrl;

      await updateProfile({
        skills: profile.skills,
        portfolioLinks: profile.portfolioLinks,
        bio: profile.bio,
        companyName: profile.companyName,
        linkedinUrl: profile.linkedinUrl,
        cvUrl: cvUrl,
      });

      toast.success('Freelancer profile created successfully! Redirecting to dashboard...');
      
      // Redirect to dashboard after successful onboarding
      setTimeout(() => {
        navigate(ROUTES.FREELANCER_DASHBOARD);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Freelancer Profile Setup</h1>
          </div>
          <p className="text-gray-600 ml-11">
            Complete your profile to start accepting projects. Add your skills, experience, and portfolio to showcase your expertise.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bio Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Professional Bio</h2>
            </div>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Describe your experience, expertise, and what makes you a great freelancer..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y"
            />
          </div>

          {/* Company Name (Optional) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Company Name (Optional)</h2>
            </div>
            <Input
              value={profile.companyName}
              onChange={(e) => setProfile(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Enter your company name if applicable"
            />
          </div>

          {/* Skills Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Skills & Technologies</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Add your skills manually, provide LinkedIn profile, or upload your CV
            </p>

            {/* LinkedIn URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile URL (Optional)
              </label>
              <Input
                value={profile.linkedinUrl}
                onChange={(e) => setProfile(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                placeholder="https://www.linkedin.com/in/your-profile"
                type="url"
              />
            </div>

            {/* CV Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CV/Resume (Optional - PDF, PNG, JPG)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center gap-2 text-gray-600">
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">
                        {cvFile ? cvFile.name : cvPreview ? 'CV uploaded - Click to change' : 'Click to upload CV'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleCvUpload}
                    className="hidden"
                  />
                </label>
                {(cvFile || cvPreview) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCvFile(null);
                      setCvPreview('');
                      setProfile(prev => ({ ...prev, cvUrl: '' }));
                      toast.success('CV removed');
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {cvPreview && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <FileText className="w-4 h-4" />
                  <span>CV ready to upload</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Or add skills manually:</p>
            </div>

            {/* Current Skills */}
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(index)}
                      className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Skill */}
            <div className="flex items-center gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                placeholder="e.g., React, Node.js, Python, UI/UX Design..."
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddSkill}
                variant="outline"
                className="shrink-0 h-10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Skill
              </Button>
            </div>
          </div>

          {/* Portfolio Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Portfolio Links</h2>
            </div>

            {/* Current Portfolio Links */}
            {profile.portfolioLinks.length > 0 && (
              <div className="space-y-3 mb-4">
                {profile.portfolioLinks.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{link.title}</div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePortfolio(index)}
                      className="shrink-0 p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Portfolio Link */}
            <div className="space-y-3">
              <Input
                value={newPortfolio.title}
                onChange={(e) => setNewPortfolio(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Project title (e.g., E-commerce Website)"
              />
              <div className="flex items-center gap-2">
                <Input
                  value={newPortfolio.url}
                  onChange={(e) => setNewPortfolio(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://github.com/username/project or live demo URL"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddPortfolio}
                  variant="outline"
                  className="shrink-0 h-10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Link
                </Button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="submit"
              disabled={saving || (profile.skills.length === 0 && !profile.linkedinUrl && !cvPreview)}
              className="min-w-[160px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>

          {/* Hint */}
          {profile.skills.length === 0 && !profile.linkedinUrl && !cvPreview && (
            <p className="text-sm text-amber-600 text-center bg-amber-50 p-3 rounded-lg border border-amber-200">
              ⚠️ Please add skills, LinkedIn URL, or upload your CV to enable your freelancer profile
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
