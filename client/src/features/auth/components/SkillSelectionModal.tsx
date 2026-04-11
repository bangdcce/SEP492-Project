/**
 * SkillSelectionModal Component
 * Modal for selecting/editing user skills
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getSkills, type Skill } from '../skills-api';
import { deleteCustomUserSkill, updateUserSkills } from '../api';

const CUSTOM_SKILL_PREFIX = '__other_skill__:';
const MAX_TOTAL_SKILLS = 20;
const MAX_CUSTOM_SKILLS = 10;

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
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      void loadSkills();
      setSelectedSkills(currentSkillIds);
      setCustomSkills([]);
      setCustomSkillInput('');
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
    const isAdding = !selectedSkills.includes(skillId);
    if (isAdding && selectedSkills.length + customSkills.length >= MAX_TOTAL_SKILLS) {
      toast.error(`You can select up to ${MAX_TOTAL_SKILLS} skills in total`);
      return;
    }

    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSave = async () => {
    const mergedSkills = [
      ...selectedSkills,
      ...customSkills.map((value) => `${CUSTOM_SKILL_PREFIX}${value}`),
    ];

    if (mergedSkills.length === 0) {
      toast.error('Please select at least one skill');
      return;
    }

    if (mergedSkills.length > MAX_TOTAL_SKILLS) {
      toast.error(`You can select up to ${MAX_TOTAL_SKILLS} skills in total`);
      return;
    }

    try {
      setSaving(true);
      await updateUserSkills(mergedSkills);
      toast.success('Skills updated successfully');
      onSkillsUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update skills');
    } finally {
      setSaving(false);
    }
  };

  const sanitizeCustomLabel = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .trim();

  const addCustomSkill = () => {
    const value = sanitizeCustomLabel(customSkillInput);
    if (!value) {
      return;
    }

    if (value.length < 2) {
      toast.error('Custom skill must be at least 2 characters');
      return;
    }

    if (customSkills.length >= MAX_CUSTOM_SKILLS) {
      toast.error(`You can add up to ${MAX_CUSTOM_SKILLS} custom skills`);
      return;
    }

    if (selectedSkills.length + customSkills.length >= MAX_TOTAL_SKILLS) {
      toast.error(`You can select up to ${MAX_TOTAL_SKILLS} skills in total`);
      return;
    }

    const normalizedValue = value.toLowerCase();
    const duplicateInMaster = availableSkills.some(
      (skill) => skill.name.toLowerCase() === normalizedValue,
    );
    const duplicateInCustom = customSkills.some(
      (skillName) => skillName.toLowerCase() === normalizedValue,
    );

    if (duplicateInMaster || duplicateInCustom) {
      toast.error('This skill already exists');
      return;
    }

    setCustomSkills((prev) => [...prev, value]);
    setCustomSkillInput('');
  };

  const removeCustomSkill = (skillName: string) => {
    setCustomSkills((prev) => prev.filter((item) => item !== skillName));
  };

  const isCustomSkill = (skill: Skill) =>
    (skill.description || '').toLowerCase().startsWith('user-added');

  const handleDeletePersistedCustomSkill = async (skillId: string) => {
    try {
      setSaving(true);
      await deleteCustomUserSkill(skillId);
      setAvailableSkills((prev) => prev.filter((skill) => skill.id !== skillId));
      setSelectedSkills((prev) => prev.filter((id) => id !== skillId));
      toast.success('Custom skill deleted successfully');
      onSkillsUpdated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete custom skill');
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
            type="button"
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
                  Selected: <span className="font-semibold text-blue-600">{selectedSkills.length + customSkills.length}</span> skill{selectedSkills.length + customSkills.length !== 1 ? 's' : ''}
                </p>
                {(selectedSkills.length > 0 || customSkills.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkills([]);
                      setCustomSkills([]);
                    }}
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
                      <span>{skill.name}</span>
                      {isCustomSkill(skill) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeletePersistedCustomSkill(skill.id);
                          }}
                          className="ml-1 text-red-500 hover:text-red-700 font-bold text-sm"
                          aria-label={`Delete ${skill.name}`}
                          disabled={saving}
                        >
                          x
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>

              {availableSkills.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">
                  No skills available
                </p>
              )}

              <div className="mt-5 border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Can&apos;t find your skill? Add your own
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomSkill();
                      }
                    }}
                    placeholder="Type custom skill..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="px-3 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-md text-sm font-medium"
                  >
                    Add
                  </button>
                </div>

                {customSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customSkills.map((skillName) => (
                      <span
                        key={skillName}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"
                      >
                        {skillName}
                        <button
                          type="button"
                          onClick={() => removeCustomSkill(skillName)}
                          className="text-blue-700 hover:text-blue-900"
                          aria-label={`Remove ${skillName}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedSkills.length + customSkills.length === 0}
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
