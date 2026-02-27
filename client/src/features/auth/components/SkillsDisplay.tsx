/**
 * SkillsDisplay Component
 * Shows user skills with verification status and proficiency
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, Award, Loader2, Plus, Edit2 } from 'lucide-react';
import { getUserSkills } from '../api';
import { SkillSelectionModal } from './SkillSelectionModal';

interface UserSkill {
  id: string;
  skillId: string;
  skillName: string;
  skillSlug: string;
  skillCategory: string;
  priority: 'PRIMARY' | 'SECONDARY';
  verificationStatus: string;
  proficiencyLevel: number | null;
  yearsOfExperience: number | null;
  portfolioUrl: string | null;
  completedProjectsCount: number;
  lastUsedAt: string | null;
}

interface SkillsDisplayProps {
  isEditing?: boolean;
  userRole?: string;
}

export function SkillsDisplay({ isEditing = false, userRole = 'FREELANCER' }: SkillsDisplayProps) {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Memoize currentSkillIds to prevent infinite re-renders
  const currentSkillIds = useMemo(() => skills.map(s => s.skillId), [skills]);

  const loadSkills = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);
      const response = await getUserSkills();
      setSkills(response.skills || []);
    } catch (error: any) {
      // Silently fail - user might not have skills yet
      console.error('Failed to load skills:', error);
    } finally {
      if (isInitial) setInitialLoading(false);
    }
  }, []);

  // Callback for modal - reload without showing loading spinner
  const handleSkillsUpdated = useCallback(() => {
    loadSkills(false);
  }, [loadSkills]);

  useEffect(() => {
    loadSkills(true);
  }, [loadSkills]);

  if (initialLoading) {
    return (
      <div className="mt-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading skills...</span>
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="mt-6 mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Skills</label>
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Skills
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {isEditing ? 'Click "Add Skills" to select your skills' : 'No skills found'}
        </p>
        
        <SkillSelectionModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentSkillIds={currentSkillIds}
          userRole={userRole}
          onSkillsUpdated={handleSkillsUpdated}
        />
      </div>
    );
  }

  const primarySkills = skills.filter((s) => s.priority === 'PRIMARY');
  const secondarySkills = skills.filter((s) => s.priority === 'SECONDARY');

  const getVerificationIcon = (status: string) => {
    if (status === 'VERIFIED') return <Shield className="w-3 h-3 text-green-600" />;
    if (status === 'PENDING') return <Shield className="w-3 h-3 text-yellow-600" />;
    return null;
  };

  const getProficiencyColor = (level: number | null) => {
    if (!level || level === 0) return 'bg-gray-100 text-gray-700 border-gray-300';
    if (level >= 8) return 'bg-green-100 text-green-700 border-green-300';
    if (level >= 5) return 'bg-blue-100 text-blue-700 border-blue-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-700">
          Skills ({skills.length})
        </label>
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Edit2 className="w-4 h-4" />
            Edit Skills
          </button>
        )}
      </div>

      {/* Primary Skills */}
      {primarySkills.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Primary Skills
          </h5>
          <div className="flex flex-wrap gap-2">
            {primarySkills.map((userSkill) => (
              <div
                key={userSkill.id}
                className={`px-3 py-2 rounded-lg border ${getProficiencyColor(userSkill.proficiencyLevel)}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{userSkill.skillName}</span>
                  {getVerificationIcon(userSkill.verificationStatus)}
                  {userSkill.proficiencyLevel !== null && userSkill.proficiencyLevel >= 8 && (
                    <Award className="w-3 h-3 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Skills */}
      {secondarySkills.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Secondary Skills
          </h5>
          <div className="flex flex-wrap gap-2">
            {secondarySkills.map((userSkill) => (
              <div
                key={userSkill.id}
                className={`px-3 py-1.5 rounded-lg border ${getProficiencyColor(userSkill.proficiencyLevel)}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{userSkill.skillName}</span>
                  {getVerificationIcon(userSkill.verificationStatus)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        💡 Tip: Skills are used by AI Matching to find relevant projects
      </p>

      <SkillSelectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentSkillIds={currentSkillIds}
        userRole={userRole}
        onSkillsUpdated={handleSkillsUpdated}
      />
    </div>
  );
}
