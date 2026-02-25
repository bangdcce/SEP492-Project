/**
 * SkillSelectionModal Component
 * Modal for selecting/editing user skills
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getSkills, type Skill } from '../skills-api';
import { updateUserSkills } from '../api';

interface SkillSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSkillIds: string[];
  userRole: string;
  onSkillsUpdated: () => void;
}

export function SkillSelectionModal({
  isOpen,
  onClose,
  currentSkillIds,
  userRole,
  onSkillsUpdated,
}: SkillSelectionModalProps) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(currentSkillIds);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSkills();
      setSelectedSkills(currentSkillIds);
    }
  }, [isOpen]); // Remove currentSkillIds from deps to prevent re-fetch

  const loadSkills = async () => {
    try {
      setLoading(true);
      const role = userRole === 'FREELANCER' || userRole === 'BROKER' ? userRole : 'FREELANCER';
      const skills = await getSkills(role);
      setAvailableSkills(skills || []);
    } catch (error) {
      console.error('[SkillSelectionModal] Failed to load skills:', error);
      toast.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSave = async () => {
    if (selectedSkills.length === 0) {
      toast.error('Please select at least one skill');
      return;
    }

    try {
      setSaving(true);
      await updateUserSkills(selectedSkills);
      toast.success('Skills updated successfully');
      onSkillsUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update skills');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Select Your Skills</h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose the skills/technologies you're proficient in
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-semibold text-blue-600">{selectedSkills.length}</span> skill{selectedSkills.length !== 1 ? 's' : ''}
                </p>
                {selectedSkills.length > 0 && (
                  <button
                    onClick={() => setSelectedSkills([])}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {availableSkills.map((skill) => {
                  const isSelected = selectedSkills.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`
                        px-4 py-2.5 rounded-lg border-2 font-medium text-sm
                        transition-all duration-200 flex items-center gap-2
                        ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {skill.name}
                    </button>
                  );
                })}
              </div>

              {availableSkills.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">
                  No skills available
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedSkills.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Skills
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
